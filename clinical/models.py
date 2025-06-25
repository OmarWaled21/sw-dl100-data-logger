from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError

class Volunteer(models.Model):
    STATUS_CHOICES = [
        ('new', 'New'),
        ('signed', 'Signed'),
    ]
    
    volunteer_id = models.CharField(max_length=6, unique=True, editable=False)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    birth_date = models.DateField()
    national_id = models.CharField(max_length=14, unique=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='new')
    pdf_file = models.FileField(upload_to='volunteers/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        # تحقق من أن الرقم القومي 14 رقم بالضبط
        if not self.national_id.isdigit() or len(self.national_id) != 14:
            raise ValidationError("National ID must be 14 digits.")

    def save(self, *args, **kwargs):
        # توليد volunteer_id قبل الحفظ الأول
        if not self.volunteer_id:
            initials = (self.first_name[0] + self.last_name[0]).upper()
            last_4_digits = self.national_id[-4:]
            self.volunteer_id = initials + last_4_digits
        self.full_clean()  # تشغل clean() قبل الحفظ
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.volunteer_id} - {self.first_name} {self.last_name}"

# Master Study File
class Study(models.Model):
    STATUS_CHOICES = [
        ('created', 'Created'),
        ('in_progress', 'In Progress'),
        ('finalized', 'Finalized'),
    ]
    study_code = models.CharField(max_length=100, unique=True)
    study_name = models.CharField(max_length=100, )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Created')
    created_at = models.DateField(auto_created=True, auto_now_add=True, )
    pdf_file = models.FileField(upload_to='studies/', blank=True, null=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)

    # assigned_staffs هي قائمة من المستخدمين (CustomUser)
    assigned_staffs = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='assigned_studies'
    )

    def clean(self):
        # شرط: لو في end_date مفيش start_date → نرفض الحفظ
        if self.end_date and not self.start_date:
            raise ValidationError("End date can't be set without a start date.")

    def save(self, *args, **kwargs):
        # تنفيذ التنظيف اليدوي قبل الحفظ
        self.clean()

        # تحديث الحالة بناءً على التواريخ
        if self.start_date:
            if self.end_date:
                self.status = 'finalized'
            else:
                self.status = 'in_progress'
        else:
            self.status = 'created'

        super().save(*args, **kwargs)

    def __str__(self):
        return self.study_code

# Study Volunteer
class StudyVolunteer(models.Model):
    volunteer = models.ForeignKey(Volunteer, on_delete=models.CASCADE)
    study = models.ForeignKey(Study, on_delete=models.CASCADE)
    pdf_file = models.FileField(upload_to='Enrollments/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.volunteer.volunteer_id} - {self.study.study_code}"

    class Meta:
        unique_together = ('volunteer', 'study')

    def clean(self):
        errors = {}
        if errors:
            raise ValidationError(errors)
        
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
            
    