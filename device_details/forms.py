from django import forms
from data_logger.models import Device

BOOLEAN_CHOICES = [(True, 'True'), (False, 'False')]
# خارج الكلاس (مثلاً في أعلى الملف)
def get_interval_choices():
    minutes_list = [1] + [i for i in range(5, 601, 5)]  # 1, 5, 10, ..., 600
    choices = []

    for minutes in minutes_list:
        seconds = minutes * 60
        hours = minutes // 60
        remaining_minutes = minutes % 60

        if hours and remaining_minutes:
            label = f"{hours} h :{remaining_minutes} min"
        elif hours:
            label = f"{hours} h"
        else:
            label = f"{minutes} m"

        choices.append((seconds, label))
    
    return choices

INTERVAL_CHOICES = get_interval_choices()

class DeviceForm(forms.ModelForm):
    interval_wifi = forms.ChoiceField(choices=INTERVAL_CHOICES, widget=forms.Select(attrs={
        'class': 'form-control',
    }))
    interval_local = forms.ChoiceField(choices=INTERVAL_CHOICES, widget=forms.Select(attrs={
        'class': 'form-control',
    }))
    use_custom_interval = forms.BooleanField(required=False, label="Use custom interval")

    class Meta:
        model = Device
        fields =  ['name', 'max_temp', 'min_temp', 'max_hum', 'min_hum', 'interval_wifi', 'interval_local']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control text-primary border-primary', 'style': 'font-weight: bold;'}),
            'max_temp': forms.NumberInput(attrs={'class': 'form-control text-primary border-primary', 'style': 'width: 100px; font-weight: bold;'}),
            'min_temp': forms.NumberInput(attrs={'class': 'form-control text-primary border-primary', 'style': 'width: 100px; font-weight: bold;'}),
            'max_hum': forms.NumberInput(attrs={'class': 'form-control text-primary border-primary', 'style': 'width: 100px; font-weight: bold;'}),
            'min_hum': forms.NumberInput(attrs={'class': 'form-control text-primary border-primary', 'style': 'width: 100px; font-weight: bold;'}),
        }

    def __init__(self, *args, **kwargs):
        super(DeviceForm, self).__init__(*args, **kwargs)
        self.fields['name'].label = "Device Name"
        self.fields['max_temp'].label = "Max Temperature"
        self.fields['min_temp'].label = "Min Temperature"
        self.fields['max_hum'].label = "Max Temperature"
        self.fields['min_hum'].label = "Min Temperature"
        self.fields['interval_wifi'].label = "Interval Wifi"
        self.fields['interval_local'].label = "Interval Local"

    def clean(self):
        cleaned_data = super().clean()
        name = cleaned_data.get("name")
        min_temp = cleaned_data.get("min_temp")
        max_temp = cleaned_data.get("max_temp")
        min_hum = cleaned_data.get("min_hum")
        max_hum = cleaned_data.get("max_hum")
        
        if min_temp is not None and max_temp is not None and max_temp <= min_temp:
            raise forms.ValidationError("Max temperature must be greater than min temperature.")

        if min_hum is not None and max_hum is not None and max_hum <= min_hum:
            raise forms.ValidationError("Max humidity must be greater than min humidity.")

        return cleaned_data
 
