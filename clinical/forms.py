from django import forms

from authentication.models import CustomUser
from .models import Volunteer, Study, StudyVolunteer
from django.conf import settings
from django.apps import apps
from django.db.models import Q

# Volunteer Screening Management
class VolunteerForm(forms.ModelForm):
    class Meta:
        model = Volunteer
        fields = ['first_name', 'last_name', 'birth_date', 'national_id', 'phone_number']
        widgets = {
            'birth_date': forms.DateInput(attrs={'type': 'date'}),
            'phone_number': forms.TextInput(attrs={'placeholder': 'Phone Number'}),
        }

    def clean_national_id(self):
        national_id = self.cleaned_data['national_id']
        if not national_id.isdigit() or len(national_id) != 14:
            raise forms.ValidationError("National ID must be 14 digits.")
        return national_id
    
    def clean_phone_number(self):
        phone_number = self.cleaned_data['phone_number']
        if phone_number and not phone_number.isdigit():
            raise forms.ValidationError("Phone number must be numeric.")
        return phone_number
    
# Study Master File Management
ustomUser = apps.get_model(settings.AUTH_USER_MODEL)

class StudyForm(forms.ModelForm):
    class Meta:
        model = Study
        fields = ['study_code', 'study_name', 'start_date', 'end_date', 'assigned_staffs', 'pdf_file']
        widgets = {
            'start_date': forms.DateInput(attrs={'type': 'date'}),
            'end_date': forms.DateInput(attrs={'type': 'date'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # المستخدمين اللي عندهم التصنيف Clinical
        clinical_users = CustomUser.objects.filter(categories__name__iexact='clinical')

        # المستخدمين المعيّنين مسبقًا للدراسة (لو بتعدل)
        assigned = self.instance.assigned_staffs.all() if self.instance.pk else CustomUser.objects.none()

        # دمجهم باستخدام filter(Q) بدلاً من union()
        self.fields['assigned_staffs'].queryset = CustomUser.objects.filter(
            Q(id__in=clinical_users) | Q(id__in=assigned)
        ).distinct()
   
   
# Study Enrollments Management
class StudyVolunteerForm(forms.ModelForm):
    class Meta:
        model = StudyVolunteer
        fields = ['volunteer', 'study']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # فلترة المتطوعين الموقعين فقط
        self.fields['volunteer'].queryset = Volunteer.objects.filter(status='signed')

        # فلترة الدراسات الغير منتهية
        self.fields['study'].queryset = Study.objects.exclude(status='finalized')