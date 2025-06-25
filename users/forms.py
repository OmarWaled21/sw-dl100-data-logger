from django import forms
from authentication.models import CustomUser
from home.models import Category

class EditUserForm(forms.ModelForm):
    categories = forms.ModelMultipleChoiceField(
        queryset=Category.objects.all(),
        widget=forms.CheckboxSelectMultiple,
        required=False  # التحقق هيكون في الـ view
    )
    
    class Meta:
        model = CustomUser
        fields = ['role', 'categories']
        widgets = {
            'role': forms.Select(attrs={'class': 'form-select'}),
        }
        
class AddUserForm(forms.ModelForm):
    password = forms.CharField(widget=forms.PasswordInput, required=True)
    categories = forms.ModelMultipleChoiceField(
        queryset=Category.objects.all(),
        widget=forms.CheckboxSelectMultiple,
        required=False  # التحقق هيكون في الـ view
    )

    class Meta:
        model = CustomUser
        fields = ['username', 'email', 'role', 'password', 'categories']
        widgets = {
            'role': forms.Select(attrs={'class': 'form-select'}),
        }