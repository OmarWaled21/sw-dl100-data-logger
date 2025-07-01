from django import forms
from .models import MasterClock
from django.utils import timezone
from .models import AutoReportSchedule

class MasterClockForm(forms.ModelForm):
    current_time = forms.DateTimeField(
        label="Current Time",
        initial=timezone.now,
        widget=forms.DateTimeInput(attrs={
            'type': 'datetime-local',
            'class': 'form-control',
            'step': '1' 
        })
    )

    class Meta:
        model = MasterClock
        fields = []

    def save(self, commit=True):
        instance = self.instance
        new_time = self.cleaned_data['current_time']
        instance.set_time(new_time)
        return instance

    
DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
SCHEDULE_CHOICES = [('daily', 'Daily'),('weekly', 'Weekly'),('monthly', 'Monthly'),]

class AutoReportForm(forms.ModelForm):
    def __init__(self, *args, used_device_ids=None, **kwargs):
        super().__init__(*args, **kwargs)

        self.fields['schedule_type'].required = True
        self.fields['schedule_type'].choices = SCHEDULE_CHOICES
        self.fields['schedule_type'].initial = 'daily'

        if used_device_ids:
            self.fields['devices'].queryset = self.fields['devices'].queryset.exclude(id__in=used_device_ids)

    class Meta:
        model = AutoReportSchedule
        fields = ['schedule_type', 'weekday', 'month_day', 'email', 'devices']
        widgets = {
            'schedule_type': forms.Select(attrs={'class': 'form-select'}),
            'weekday': forms.Select(choices=[(i, day) for i, day in enumerate(DAY_NAMES)], attrs={'class': 'form-select'}),
            'month_day': forms.NumberInput(attrs={'class': 'form-control', 'min': 1, 'max': 31}),
            'email': forms.EmailInput(attrs={'class': 'form-control'}),
            'devices': forms.CheckboxSelectMultiple(),
            'enabled': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }

    def clean(self):
        cleaned_data = super().clean()
        devices = cleaned_data.get('devices')
        if devices and AutoReportSchedule.objects.filter(devices__in=devices).exists():
            raise forms.ValidationError("One or more selected devices are already scheduled.")
        return cleaned_data
