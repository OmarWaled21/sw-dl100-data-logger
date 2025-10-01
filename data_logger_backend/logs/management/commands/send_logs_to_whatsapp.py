# import time
# from django.core.management.base import BaseCommand
# from logs.models import DeviceLog, AdminLog
# import pywhatkit as kit
# from concurrent.futures import ThreadPoolExecutor
# from twilio.rest import Client
# from django.conf import settings
# from django.core.mail import send_mail

# account_sid = settings.TWILIO_ACCOUNT_SID
# auth_token = settings.TWILIO_AUTH_TOKEN
# twilio_number = settings.TWILIO_PHONE_NUMBER
# client = Client(account_sid, auth_token)

# def format_phone_number(phone):
#     if not phone.startswith('+'):
#         return '+2' + phone  # مثال: فرض إنه مصري
#     return phone

# def send_sms(to, message):
#     try:
#         message = client.messages.create(
#             body=message,
#             from_=twilio_number,
#             to=to
#         )
#         print(f"SMS sent to {to}: {message.sid}")
#     except Exception as e:
#         print(f"Error sending SMS: {e}")
        
# def send_email(to_email, subject, message):
#     try:
#         send_mail(
#             subject,
#             message,
#             settings.DEFAULT_FROM_EMAIL,
#             [to_email],
#             fail_silently=False,
#         )
#         print(f"Email sent to {to_email}")
#     except Exception as e:
#         print(f"Error sending email to {to_email}: {e}")

# def send_log_to_group(group_info, all_logs):
#     try:
#         # دمج جميع الرسائل في رسالة واحدة
#         full_message = ""
#         for log in all_logs:
#             full_message += f"[{log['timestamp']}] {log['source']}: {log['type']} - {log['message']}\n"

#         # إرسال عبر WhatsApp
#         if(group_info.whatsapp_is_active == True) and group_info.group_id:
#             kit.sendwhatmsg_to_group_instantly(group_info.group_id, full_message, 30, True, 2)
#             time.sleep(2)  # تفادي الحظر

#         # إرسال عبر SMS
#         formatted_phone_number = format_phone_number(group_info.phone_number)
#         print(f"Formatted phone number: {formatted_phone_number}")  # طباعة الرقم للتأكد من صحته
#         print(f"SMS active: {group_info.sms_is_active}")  # طباعة حالة إرسال الـ SMS للتأكد
#         if (group_info.sms_is_active == True):
#             send_sms(formatted_phone_number, full_message)
#         else:
#             print(f"No phone number found for admin {group_info.admin.username}. Skipping SMS.")


#         # Gmail
#         if group_info.gmail_is_active and group_info.email:
#             subject = f"Logs from Admin {group_info.admin.username}"
#             send_email(group_info.email, subject, full_message)
#         else:
#             print(f"No email configured or Gmail not active for admin {group_info.admin.username}")


#         # تعليم الـ logs كمرسلة
#         ids = [log['id'] for log in all_logs]
#         DeviceLog.objects.filter(id__in=ids).update(sent=True)
#         AdminLog.objects.filter(id__in=ids).update(sent=True)
#         print(f"Logs sent and marked as sent for admin {group_info.admin.username}.")

#     except Exception as e:
#         print(f"Error sending logs to group {group_info.group_id}: {e}")

# def run_logs_worker():
#     """Loop that keeps sending logs every few seconds"""
#     POLL_INTERVAL = 5
#     print("🚀 Logs worker started... (WhatsApp/SMS/Email sender)")
#     while True:
#         try:
#             send_unsent_logs()
#         except Exception as e:
#             print(f"❌ Error in logs worker: {e}")
#         time.sleep(POLL_INTERVAL)

# def send_unsent_logs():
#     active_groups = AdminGroupInfo.objects.filter(whatsapp_is_active=True)
#     if not active_groups:
#         return

#     with ThreadPoolExecutor(max_workers=5) as executor:
#         for group_info in active_groups:
#             device_logs = DeviceLog.objects.filter(sent=False, device__admin=group_info.admin)
#             admin_logs = AdminLog.objects.filter(sent=False, admin=group_info.admin)

#             all_logs = list(device_logs) + list(admin_logs)
#             all_logs = sorted(
#                 [log.get_log_info() for log in all_logs],
#                 key=lambda log: log['timestamp']
#             )

#             if not all_logs:
#                 continue

#             executor.submit(send_log_to_group, group_info, all_logs)

# class Command(BaseCommand):
#     help = 'Send unsent logs to WhatsApp group'

#     def handle(self, *args, **kwargs):
#         run_logs_worker()