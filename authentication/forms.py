from django import forms
from .models import CustomUser

class UpdateUserForm(forms.ModelForm):
    current_password = forms.CharField(widget=forms.PasswordInput, required=True, label="Current Password")
    new_password = forms.CharField(widget=forms.PasswordInput, required=True, label="New Password")
    confirm_new_password = forms.CharField(widget=forms.PasswordInput, required=True, label="Confirm New Password")

    class Meta:
        model = CustomUser
        fields = ['username']
        widgets = {
            'username': forms.TextInput(attrs={'class': 'form-control'}),
        }

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop('user', None)
        super(UpdateUserForm, self).__init__(*args, **kwargs)

    def clean_current_password(self):
        current_password = self.cleaned_data.get('current_password')
        if not self.user.check_password(current_password):
            raise forms.ValidationError("Current password is incorrect.")
        return current_password

    def clean(self):
        cleaned_data = super().clean()
        new_password = cleaned_data.get("new_password")
        confirm_new_password = cleaned_data.get("confirm_new_password")

        if new_password and confirm_new_password and new_password != confirm_new_password:
            self.add_error('confirm_new_password', "Passwords do not match.")
