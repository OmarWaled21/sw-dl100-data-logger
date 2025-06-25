from django import forms
from .models import MasterClock
from django.utils import timezone

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