from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework import status

from authentication.models import CustomUser
from home.models import Department, Device
from .models import DeviceLog, AdminLog, NotificationSettings
from .serializers import DeviceLogSerializer, AdminLogSerializer
from home.utils import get_master_time
from datetime import datetime, timedelta
from django.utils.dateparse import parse_time
from django.db.models import Q

class LogViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _get_logs_queryset(self, request, device_id=None, filter_date=None, error_types=None):
        """Helper to get logs based on user role, department, and filters."""
        user = request.user

        # ✅ Admin يشوف كل الأجهزة وكل الأقسام
        if user.role == 'admin':
            device_logs = DeviceLog.objects.select_related('device', 'department')
            user_logs = AdminLog.objects.all()

        # ✅ Manager يشوف أجهزة قسمه فقط
        elif user.role == 'manager':
            device_logs = DeviceLog.objects.filter(
                department=user.department
            ).select_related('device', 'department')
            user_logs = AdminLog.objects.filter(
                Q(manager=user) | Q(user=user)
            )

        # ✅ User يشوف قسمه فقط
        else:
            device_logs = DeviceLog.objects.filter(
                department=user.department
            ).select_related('device', 'department')
            user_logs = AdminLog.objects.filter(user=user)

        # فلترة بالـ device_id لو تم تحديده
        if device_id:
            device_logs = device_logs.filter(device__id=device_id)

        # فلترة بالتاريخ
        if filter_date:
            try:
                base_master_time = get_master_time()
                naive_start_date = datetime.strptime(filter_date, "%Y-%m-%d")
                start_date = base_master_time.replace(
                    year=naive_start_date.year,
                    month=naive_start_date.month,
                    day=naive_start_date.day,
                    hour=0, minute=0, second=0, microsecond=0
                )
                end_date = start_date + timedelta(days=1)
                device_logs = device_logs.filter(timestamp__gte=start_date, timestamp__lt=end_date)
                user_logs = user_logs.filter(timestamp__gte=start_date, timestamp__lt=end_date)
            except ValueError:
                raise ValueError("Invalid date format, must be YYYY-MM-DD")

        # فلترة بنوع الخطأ
        if error_types and 'All' not in error_types:
            device_logs = device_logs.filter(error_type__in=error_types)

        return device_logs, user_logs

    @action(detail=False, methods=['get'], url_path='device')
    def device_logs(self, request):
        """GET /logs/device/"""
        device_logs, _ = self._get_logs_queryset(request)
        serialized = DeviceLogSerializer(device_logs.order_by('-timestamp'), many=True).data
        table_head = ["time", "device", "error_type", "message"]
        return Response({
            "message": "Device logs fetched successfully",
            "table_head": table_head,
            "results": serialized,
            "unread_count": 0,  # لو عندك unread logic حطها هنا
        })

    @action(detail=False, methods=['get'], url_path='admin')
    def admin_logs(self, request):
        """GET /logs/admin/"""
        _, user_logs = self._get_logs_queryset(request)
        serialized = AdminLogSerializer(user_logs.order_by('-timestamp'), many=True).data
        table_head = ["time", "user", "type", "message"]
        return Response({
            "message": "Admin logs fetched successfully",
            "table_head": table_head,
            "results": serialized,
            "unread_count": 0,
        })

    @action(detail=False, methods=['get'])
    def latest_local(self, request):
        """GET /logs/latest_local/"""
        user = request.user

        if user.role == 'admin':
            last_log = DeviceLog.objects.filter(device__admin=user).order_by('-timestamp').first()
        else:
            last_log = DeviceLog.objects.filter(device__admin=user.admin).order_by('-timestamp').first()

        if not last_log:
            return Response({"message": None})

        return Response({
            "message": f"[{last_log.device.name or last_log.device.device_id}] {last_log.error_type}: {last_log.message or 'No message'}",
            "timestamp": last_log.timestamp
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def create_log(self, request):
        user = request.user
        log_type = request.data.get('log_type', 'admin')
        message = request.data.get('message')
        action = request.data.get('action')

        if log_type == 'device':
            serializer = DeviceLogSerializer(data=request.data)
        else:
            # منع تكرار log متشابه في أقل من 5 ثواني
            admin = getattr(user, 'admin', user)
            recent = AdminLog.objects.filter(
                user=user,
                action=action,
                message=message,
                timestamp__gte=get_master_time()- timedelta(seconds=5)
            ).first()
            if recent:
                return Response({"message": "Duplicate log ignored"}, status=status.HTTP_200_OK)

            serializer = AdminLogSerializer(
                data=request.data,
                context={'user': user, 'admin': admin}
            )

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role == 'admin':
            unread_device_logs = DeviceLog.objects.filter(is_read=False).count()
            unread_admin_logs = AdminLog.objects.filter(is_read=False).count()
        elif user.role == 'manager':
            unread_device_logs = DeviceLog.objects.filter(department=user.department, is_read=False).count()
            unread_admin_logs = AdminLog.objects.filter(Q(manager=user) | Q(user=user), is_read=False).count()
        else:
            unread_device_logs = DeviceLog.objects.filter(department=user.department, is_read=False).count()
            unread_admin_logs = AdminLog.objects.filter(user=user, is_read=False).count()

        return Response({
            "device_logs": unread_device_logs,
            "admin_logs": unread_admin_logs,
            "total": unread_device_logs + unread_admin_logs,
        })
        
class MarkLogsReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        log_type = request.data.get("type")
        if log_type == "device":
            DeviceLog.objects.filter(is_read=False).update(is_read=True)
            return Response({"status": "ok", "type": "device"})
        elif log_type == "admin":
            AdminLog.objects.filter(is_read=False).update(is_read=True)
            return Response({"status": "ok", "type": "admin"})
        else:
            return Response({"error": "Invalid type"}, status=400)

class NotificationSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_target_user(self, requester, user_id):
        """
        Returns the target user object the requester is allowed to access/edit.
        If user_id is None -> target is requester.
        Enforce permissions:
         - admin: can edit users in requester.managed_users
         - manager: can edit users in same department only
         - user: only self
        """
        if not user_id:
            return requester

        # try fetch candidate
        candidate = CustomUser.objects.filter(id=user_id).first()
        if not candidate:
            return None

        # superuser can do anything
        if requester.is_superuser:
            return candidate

        # admin: can edit only managed users
        if getattr(requester, "role", None) == "admin":
            managed_ids = requester.managed_users.values_list("id", flat=True)
            if candidate.id in managed_ids:
                return candidate
            return None

        # manager: only users in same department
        if getattr(requester, "role", None) == "manager":
            if getattr(requester, "department", None) and candidate.department_id == requester.department_id:
                return candidate
            return None

        # normal user: can only access self (already handled when user_id is None)
        return None

    def get(self, request):
        user = request.user
        user_id = request.query_params.get("user_id")  # optional
        target = self._get_target_user(user, user_id)

        if target is None:
            return Response({"detail": "غير مصرح بالوصول إلى إعدادات هذا المستخدم."}, status=status.HTTP_403_FORBIDDEN)

        settings, _ = NotificationSettings.objects.get_or_create(user=target)

        # كل الأجهزة في قسم المستخدم
        section_devices = Device.objects.filter(department=target.department)

        return Response({
            "user_id": target.id,
            "user_username": target.username,
            "gmail_is_active": settings.gmail_is_active,
            "email": settings.email,
            "report_time": settings.report_time.strftime("%H:%M"),
            "local_is_active": settings.local_is_active,  # always True
            "devices": [{"id": d.id, "name": d.name, "department_id": getattr(d.department, "id", None)} for d in settings.devices.all()],
            "section_devices": [{"id": d.id, "name": d.name, "department_id": getattr(d.department, "id", None)} for d in section_devices],
        })

    def post(self, request):
        user = request.user
        data = request.data
        target_user_id = data.get("user_id")  # optional
        target = self._get_target_user(user, target_user_id)

        if target is None:
            return Response({"detail": "غير مصرح بالتعديل على إعدادات هذا المستخدم."}, status=status.HTTP_403_FORBIDDEN)

        settings, _ = NotificationSettings.objects.get_or_create(user=target)

        # لا تسمح بتغيير local_is_active عبر الـ API
        settings.gmail_is_active = data.get("gmail_is_active", settings.gmail_is_active)
        settings.email = data.get("email", settings.email)
        settings.report_time = parse_time(data.get("report_time", settings.report_time.strftime("%H:%M")))
        settings.save()

        # update devices (only allow devices that requester is permitted to assign)
        device_ids = data.get("device_ids", [])
        if device_ids is None:
            device_ids = []

        # allowed devices depend on requester's role
        if user.is_superuser:
            allowed_devices = Device.objects.filter(id__in=device_ids)
        elif getattr(user, "role", None) == "admin":
            # admin can manage devices for their managed users' departments:
            managed_deps = CustomUser.objects.filter(id__in=user.managed_users.values_list("id", flat=True)).values_list("department", flat=True)
            allowed_devices = Device.objects.filter(id__in=device_ids, department__in=managed_deps)
        elif getattr(user, "role", None) == "manager":
            # manager only devices in his department
            allowed_devices = Device.objects.filter(id__in=device_ids, department=user.department)
        else:
            allowed_devices = Device.objects.filter(id__in=device_ids, department=target.department) if target == user else Device.objects.none()

        settings.devices.set(allowed_devices)
        settings.save()

        return Response({"success": True})
      
class NotificationTreeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not (user.role in ['admin', 'manager'] or user.is_superuser):
            return Response({"detail": "ليس لديك صلاحية الوصول"}, status=status.HTTP_403_FORBIDDEN)

        # list of departments user can see
        if user.is_superuser:
            departments = Department.objects.all()
        elif user.role == 'admin':
            # departments of users the admin manages
            managed_users = user.managed_users.all()
            dep_ids = managed_users.values_list('department_id', flat=True)
            departments = Department.objects.filter(id__in=dep_ids)
        else:  # manager
            departments = Department.objects.filter(id=user.department_id)

        tree = []
        for dep in departments:
            users_qs = CustomUser.objects.filter(department=dep)
            devices_qs = Device.objects.filter(department=dep)
            devices_list = list(devices_qs)  # cached
            users_list = []
            for u in users_qs:
                ns, _ = NotificationSettings.objects.get_or_create(user=u)
                user_devices = set(ns.devices.values_list('id', flat=True))
                users_list.append({
                    "id": u.id,
                    "username": u.username,
                    "email": u.email,
                    "devices": [
                        {"id": d.id, "name": d.name, "enabled": d.id in user_devices}
                        for d in devices_list
                    ]
                })
            tree.append({"department": dep.name, "department_id": dep.id, "users": users_list})

        return Response(tree)
