# views.py
from datetime import datetime
import os
from django.shortcuts import get_object_or_404, render, redirect
from django.contrib import messages
from django.http import FileResponse, HttpResponseRedirect, JsonResponse
from django.utils.text import slugify
from django.urls import reverse
from django.db.models import Q, Case, When, Value, IntegerField
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from collections import defaultdict
from clinical.utils.sign_pdf import add_signature_to_pdf
from clinical.utils.fill_pdf import fill_pdf_data
from sw_dl100 import settings
from data_logger.utils import get_master_time
from .models import Volunteer, StudyVolunteer, Study
from .forms import StudyForm, StudyVolunteerForm, VolunteerForm

# Decorator to check user has 'clinical' access
def clinical_required(view_func):
    @login_required
    def wrapper(request, *args, **kwargs):
        if not request.user.categories.filter(slug='clinical').exists():
            messages.error(request, "You don't have permission to access this page.")
            return redirect('home')
        return view_func(request, *args, **kwargs)
    return wrapper

@clinical_required
def home_view(request):
    master_time = get_master_time()
    
    return render(request, 'clinical/clinical_home.html', {
        'current_section': 'clinical',
        'page_title': 'Clinical Section',
        'current_time': master_time,
        "signed_forms": Volunteer.objects.filter(status="signed").count(),
        "new_forms": Volunteer.objects.filter(status="new").count(),
        "volunteer_count": Volunteer.objects.count(),
        "pending_study_forms": StudyVolunteer.objects.filter(study__status="in_progress").count(),
        "studies": Study.objects.count(),
        "finalized_studies": Study.objects.filter(status="Finalized").count(),
    })

# Volunteer Screening Management
@clinical_required
def volunteer_form(request, volunteer_id=None):
    is_edit = request.GET.get('edit') == '1'  # هنا نقرأ قيمة edit من الرابط

    if volunteer_id:
        volunteer = get_object_or_404(Volunteer, volunteer_id=volunteer_id)
        form = VolunteerForm(request.POST or None, instance=volunteer)
    else:
        volunteer = None
        form = VolunteerForm(request.POST or None)
        is_edit = False

    if request.method == 'POST':
        if form.is_valid():
            if is_edit:
                form.instance.national_id = volunteer.national_id
            else:
                national_id = form.cleaned_data.get('national_id')
                if Volunteer.objects.filter(national_id=national_id).exists():
                    form.add_error('national_id', 'This National ID is already registered.')
                    return render(request, 'clinical/register_volunteer.html', {'form': form, 'is_edit': is_edit})

            volunteer = form.save(commit=False)
            if not is_edit:
                volunteer.status = 'new'
            volunteer.save()
            
             # توليد PDF
            template_path = os.path.join(settings.BASE_DIR, 'media/pdf_templates/temp_data.pdf')
            output_dir = os.path.join(settings.MEDIA_ROOT, 'volunteers')
            os.makedirs(output_dir, exist_ok=True)  # ✅ ينشئ المجلد لو مش موجود
            output_path = os.path.join(output_dir, f'VOL_{volunteer.volunteer_id}_Screening.pdf')
            fill_pdf_data(volunteer, template_path, output_path)
            
            # حفظ مسار PDF في الحقل
            relative_path = f'volunteers/VOL_{volunteer.volunteer_id}_Screening.pdf'
            volunteer.pdf_file.name = relative_path
            volunteer.save()

            # احفظ المسار داخل جلسة مؤقتًا (اختياري)
            request.session['pdf_path'] = f'volunteers/VOL_{volunteer.volunteer_id}_Screening.pdf'
            messages.success(request, f"Volunteer {'updated' if is_edit else 'registered'} successfully!")
            return redirect('confirm_pdf', volunteer_id=volunteer.volunteer_id)

        else:
            errors = [f"{field}: {error}" for field, errors in form.errors.items() for error in errors]
            messages.error(request, "Errors: " + "; ".join(errors))

    return render(request, 'clinical/register_volunteer.html', {'form': form, 'is_edit': is_edit, 'volunteer': volunteer, 'page_title': 'Volunteer Data' })


@clinical_required
def confirm_pdf(request, volunteer_id):
    volunteer = get_object_or_404(Volunteer, volunteer_id=volunteer_id)
    pdf_file = volunteer.pdf_file.url if volunteer.pdf_file else None
    
    if not pdf_file:
        messages.error(request, "PDF file not found.")
        return redirect('clinical')
    
    return render(request, 'clinical/confirm_pdf.html', {
        'volunteer': volunteer,
        'pdf_file': pdf_file
    })


@clinical_required
def sign_pdf_page(request, volunteer_id):
    volunteer = get_object_or_404(Volunteer, volunteer_id=volunteer_id)
    pdf_file = volunteer.pdf_file.url if volunteer.pdf_file and os.path.exists(os.path.join(settings.MEDIA_ROOT, volunteer.pdf_file.name)) else None

    if not pdf_file:
        messages.error(request, "PDF file not found.")
        return redirect('clinical')

    return render(request, 'clinical/sign_pdf_page.html', {
        'volunteer': volunteer,
        'pdf_file': pdf_file,
    })


@clinical_required
@require_POST
def submit_signature(request, volunteer_id):
    signature = request.POST.get('signature')
    if not signature:
        messages.error(request, "No signature provided.")
        return redirect('sign_pdf_page', volunteer_id=volunteer_id)
    
    volunteer = get_object_or_404(Volunteer, volunteer_id=volunteer_id)
    pdf_path = os.path.join(settings.MEDIA_ROOT, f'volunteers/VOL_{volunteer.volunteer_id}_Screening.pdf')
    
    if not os.path.exists(pdf_path):
        messages.error(request, "PDF file does not exist.")
        return redirect('sign_pdf_page', volunteer_id=volunteer_id)
    
    add_signature_to_pdf(volunteer_id, signature, pdf_path)
    
    messages.success(request, "Signature added to all pages.")
    return redirect('confirm_signature', volunteer_id=volunteer_id)


@clinical_required
def confirm_signature(request, volunteer_id):
    volunteer = get_object_or_404(Volunteer, volunteer_id=volunteer_id)
    pdf_file = volunteer.pdf_file.url if volunteer.pdf_file else None
    pdf_path = os.path.join(settings.MEDIA_ROOT, pdf_file)

    if not pdf_file:
        messages.error(request, "PDF file not found.")
        return redirect('clinical')

    if request.method == 'POST':
        action = request.POST.get('action')
        
        if action == 'confirm':
            # تأكيد التوقيع النهائي
            volunteer.status = 'signed'
            volunteer.save()
            messages.success(request, "Volunteer form has been finalized successfully!")
            return redirect('clinical')

        elif action == 'reassign':
            # إعادة التوقيع أو التعديل (يرجع لصفحة التوقيع مثلاً)
            return redirect('sign_pdf_page', volunteer_id=volunteer.volunteer_id)

        elif action == 'cancel':
            # حذف المتطوع وملف PDF الخاص به
            volunteer.delete()
            if os.path.exists(pdf_path):
                os.remove(pdf_path)
            messages.success(request, "Volunteer and associated PDF have been deleted.")
            return redirect('clinical')

        else:
            messages.error(request, "Invalid action.")
            return redirect('confirm_signature', volunteer_id=volunteer_id)

    # GET request — عرض الصفحة مع PDF
    return render(request, 'clinical/confirm_signature.html', {
        'volunteer': volunteer,
        'pdf_file': pdf_file,
    })
    

@clinical_required
def all_volunteers_view(request):
    volunteers = Volunteer.objects.all().order_by('-created_at')  # تأكد أن لديك حقل created_at في الموديل
    
    # Filter by status
    status = request.GET.get('status')
    if status in ['new', 'signed']:
        volunteers = volunteers.filter(status=status)

    # Filter by birth year range
    year_start = request.GET.get('birth_year_start')
    year_end = request.GET.get('birth_year_end')
    
    if year_start and year_end:
        try:
            year_start = int(year_start)
            year_end = int(year_end)
            volunteers = volunteers.filter(
                birth_date__year__gte=year_start,
                birth_date__year__lte=year_end
            )
        except ValueError:
            pass  # تجاهل لو القيم مش أرقام صحيحة
        
    # Filter by study
    study_code = request.GET.get('study')
    if study_code:
        if study_code == '__none__':
            # Get signed volunteers who are NOT in any study
            volunteers = volunteers.filter(status='signed').exclude(
                id__in=StudyVolunteer.objects.values_list('volunteer_id', flat=True)
            )
        else:
            volunteers = volunteers.filter(studyvolunteer__study__study_code=study_code)
            
    # Filter by created_at month and year
    months = list(range(1, 13)) 
    current_year = datetime.now().year
    created_year = request.GET.get('created_year')
    created_month = request.GET.get('created_month')

    if created_year and created_month:
        try:
            created_year = int(created_year)
            created_month = int(created_month)
            volunteers = volunteers.filter(
                created_at__year=created_year,
                created_at__month=created_month
            )
        except ValueError:
            pass  # تجاهل القيم غير الصحيحة
    
    # Search by name, national_id, or volunteer_id
    search_query = request.GET.get('search')
    if search_query:
        volunteers = volunteers.filter(
            Q(first_name__icontains=search_query) |
            Q(last_name__icontains=search_query) |
            Q(national_id__icontains=search_query) |
            Q(volunteer_id__icontains=search_query)
        )
    
    # الحصول على علاقات الدراسات
    volunteer_studies_map = defaultdict(list)
    for sv in StudyVolunteer.objects.select_related('study', 'volunteer'):
        volunteer_studies_map[sv.volunteer_id].append(sv.study.study_code)
        
    signed_volunteer_count = Volunteer.objects.filter(status='signed').count()
    study_volunteers = StudyVolunteer.objects.count()
    signed_not_in_study = signed_volunteer_count - study_volunteers

    return render(request, 'clinical/all_volunteers.html', {
        'volunteers': volunteers,
        'current_section': 'clinical',
        'page_title': 'All Volunteers',
        "volunteer_count": Volunteer.objects.count(),
        "signed_volunteer_count": signed_volunteer_count,
        "study_volunteers":study_volunteers,
        "signed_not_in_study":signed_not_in_study,
        "studies": Study.objects.all(), 
        "selected_study": study_code,
        'volunteer_studies_map': dict(volunteer_studies_map),
        'months': months,
        'created_year': current_year
    })
    
@clinical_required
def delete_volunteer(request, volunteer_id):
    volunteer = get_object_or_404(Volunteer, volunteer_id=volunteer_id)
    
    # حذف ملف الـ PDF إذا موجود
    if volunteer.pdf_file:
        pdf_path = os.path.join(settings.MEDIA_ROOT, volunteer.pdf_file.name)
        if os.path.exists(pdf_path):
            os.remove(pdf_path)
    
    # حذف المتطوع من قاعدة البيانات
    volunteer.delete()
    
    messages.success(request, "Volunteer and associated PDF have been deleted successfully.")
    return HttpResponseRedirect(reverse('all_volunteers'))

# Study Master File Management
@clinical_required
def study_form(request, study_code=None):
    is_edit = False
    study = None
    selected_staffs = []

    if study_code:
        study = get_object_or_404(Study, study_code=study_code)
        is_edit = True
        selected_staffs = list(study.assigned_staffs.values_list('id', flat=True))
        
    if request.method == 'POST':
        form = StudyForm(request.POST, request.FILES, instance=study)
        if form.is_valid():
            study = form.save(commit=False)
            if not is_edit:
                study.status = 'created'  # عند الإنشاء فقط
            study.save()
            form.save_m2m()
            messages.success(request, "Study saved successfully.")
            return redirect('study_list')  # عدّل حسب اسم صفحة عرض الدراسات
        else:
            errors = [f"{field}: {error}" for field, errors in form.errors.items() for error in errors]
            messages.error(request, "Errors: " + "; ".join(errors))
    else:
        form = StudyForm()
    
    return render(request, 'clinical/study_form.html', {
        'form': form,
        'page_title': 'Edit Master Study' if is_edit else 'Create Master Study',
        'is_edit': is_edit,
        'study': study,
        'selected_staffs': selected_staffs,
    })

@clinical_required
def suggest_study_code(request):
    name = request.GET.get('name', '')
    if not name:
        return JsonResponse({'suggested_code': ''})
    
    base_code = slugify(name)[:8].upper().replace('-', '')
    # عدّ كم دراسة بنفس الـ base_code موجودة
    existing_count = Study.objects.filter(study_code__startswith=base_code).count()
    suggested_code = f"{base_code}-{existing_count+1:03d}"
    
    return JsonResponse({'suggested_code': suggested_code})

@clinical_required
def study_list(request):
    studies = Study.objects.all()

    # فلترة على حسب status لو تم إرسالها كـ query param
    status_filter = request.GET.get('status')
    if status_filter:
        studies = studies.filter(status=status_filter)

    # لو في فلتر بحث مثلا:
    search_query = request.GET.get('search')
    if search_query:
        studies = studies.filter(
            Q(study_name__icontains=search_query) | Q(study_code__icontains=search_query)
        )
        
    # ترتيب حسب الحالة (created أولاً، ثم in_progress، ثم finalized)
    studies = studies.annotate(
        status_order=Case(
            When(status='created', then=Value(1)),
            When(status='in_progress', then=Value(2)),
            When(status='finalized', then=Value(3)),
            default=Value(4),
            output_field=IntegerField(),
        )
    ).order_by('status_order', 'start_date')  # ممكن تضيف ترتيب إضافي حسب التاريخ مثلاً
    
    return render(request, 'clinical/study_list.html', {
        'studies': studies,
        'page_title': 'Study List',
        'status_filter': status_filter,
    })

def delete_study(request, study_code):
    study = get_object_or_404(Study, study_code=study_code)
    if request.method == 'POST':
        study.delete()
        return redirect('clinical')
    return render(request, 'clinical/delete_study_confirm.html', {'study': study})

@clinical_required
@require_POST
def start_study(request, study_code):
    study = get_object_or_404(Study, study_code=study_code)
    if study.status == 'created':
        study.status = 'in_progress'
        study.start_date = get_master_time()
        study.save()
        messages.success(request, f"Study {study.study_name} started.")
    else:
        messages.error(request, "Cannot start this study.")
    return redirect('study_list')  # أو رابط صفحة قائمة الدراسات

@clinical_required
@require_POST
def end_study(request, study_code):
    study = get_object_or_404(Study, study_code=study_code)
    if study.status == 'in_progress':
        study.status = 'finalized'
        study.end_date = get_master_time()
        study.save()
        messages.success(request, f"Study {study.study_name} finalized.")
    else:
        messages.error(request, "Cannot end this study.")
    return redirect('study_list')

@clinical_required
def view_study_pdf(request, study_code):
    study = get_object_or_404(Study, study_code=study_code)
    if study.pdf_file:
        return FileResponse(study.pdf_file.open('rb'), content_type='application/pdf')
    return redirect('clinical')

# Study Enrollments Management
@clinical_required
def enroll_volunteer(request):
    if request.method == 'POST':
        form = StudyVolunteerForm(request.POST, request.FILES)
        if form.is_valid():
            volunteer = form.cleaned_data['volunteer']
            study = form.cleaned_data['study']

            # Generate filled PDF path
            input_pdf_path = os.path.join(settings.MEDIA_ROOT, 'pdf_templates', 'temp_signed_data.pdf')
            output_dir = os.path.join(settings.MEDIA_ROOT, 'enrollments')
            os.makedirs(output_dir, exist_ok=True)
            filled_pdf_path = os.path.join(output_dir, f'enrolled_{volunteer.volunteer_id}_{study.study_code}.pdf')

            # Fill PDF with volunteer data
            fill_pdf_data(volunteer, input_pdf_path, filled_pdf_path)

            # Create StudyVolunteer record but don't save yet
            enrollment = form.save(commit=False)
            
            # Store the PDF path in session for later use after signing
            request.session['enrollment_data'] = {
                'volunteer_id': volunteer.volunteer_id,
                'study_code': study.study_code,
                'pdf_path': f'enrollments/enrolled_{volunteer.volunteer_id}_{study.study_code}.pdf'
            }

            return render(request, 'clinical/sign_pdf_enrollment.html', {
                'volunteer': volunteer,
                'study': study,
                'pdf_url': os.path.join(settings.MEDIA_URL, 'enrollments', f'enrolled_{volunteer.volunteer_id}_{study.study_code}.pdf'),
                'submit_url': reverse('submit_enrollment_signature'),
            })
        else:
            errors = [f"{field}: {error}" for field, errors in form.errors.items() for error in errors]
            messages.error(request, "Errors: " + "; ".join(errors))
    else:
        form = StudyVolunteerForm()
    return render(request, 'clinical/enroll_volunteer.html', {
        'form': form,
        'page_title': 'Enroll Volunteer in Study',
    })

@clinical_required
def study_volunteers(request, study_code):
    study = get_object_or_404(Study, study_code=study_code)
    study_volunteers = StudyVolunteer.objects.filter(study=study).select_related('volunteer')
    assigned_staffs = study.assigned_staffs.all()
    
    # Search by name, national_id, or volunteer_id
    search_query = request.GET.get('search')
    if search_query:
        study_volunteers = study_volunteers.filter(
            Q(volunteer__first_name__icontains=search_query) |
            Q(volunteer__volunteer_id__icontains=search_query)
        )

    return render(request, 'clinical/study_volunteers.html', {
        'study': study,
        'volunteers': study_volunteers,
        'assigned_staffs': assigned_staffs,
        'page_title': 'Study Volunteers',
    })

@clinical_required
@require_POST
def submit_enrollment_signature(request):
    # Retrieve data from session
    enrollment_data = request.session.get('enrollment_data')
    if not enrollment_data:
        messages.error(request, "Session data missing. Please start the enrollment process again.")
        return redirect('enroll_volunteer')

    signature = request.POST.get('signature')
    if not signature:
        messages.error(request, "No signature provided.")
        return redirect('enroll_volunteer')

    try:
        volunteer = Volunteer.objects.get(volunteer_id=enrollment_data['volunteer_id'])
        study = Study.objects.get(study_code=enrollment_data['study_code'])
        pdf_path = os.path.join(settings.MEDIA_ROOT, enrollment_data['pdf_path'])

        # Add signature to PDF
        add_signature_to_pdf(volunteer.volunteer_id, signature, pdf_path)

        # Create and save the enrollment record
        enrollment = StudyVolunteer.objects.create(
            volunteer=volunteer,
            study=study,
            pdf_file=enrollment_data['pdf_path']
        )

        # Clean up session
        del request.session['enrollment_data']

        messages.success(request, f"Volunteer {volunteer.volunteer_id} enrolled in study {study.study_code} successfully!")
        return redirect('study_list')

    except Exception as e:
        messages.error(request, f"Error completing enrollment: {str(e)}")
        return redirect('enroll_volunteer')
    
def delete_enrollment(request, enrollment_id):
    enrollment = get_object_or_404(StudyVolunteer, id=enrollment_id)
    
    pdf_filename = f'enrolled_{enrollment.volunteer.volunteer_id}_{enrollment.study.study_code}.pdf'
    pdf_path = os.path.join(settings.MEDIA_ROOT, 'enrollments', pdf_filename)
    
    if os.path.exists(pdf_path):
        try:
            os.remove(pdf_path)
        except Exception as e:
            messages.warning(request, f"PDF file deletion failed: {str(e)}")
    
    if request.method == "POST" or request.method == "GET":  # لو عايز تتأكد فقط من الحذف بدون POST
        enrollment.delete()
        messages.success(request, "Enrollment deleted successfully.")
        return redirect('study_volunteers', study_code=enrollment.study.study_code)  # رجع لصفحة مناسبة بعد الحذف
    
