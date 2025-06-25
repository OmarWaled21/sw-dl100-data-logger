from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from logs.models import AdminLog
from django.contrib.auth.views import  PasswordResetConfirmView, PasswordResetCompleteView
from django.contrib.auth.forms import PasswordResetForm
from django.views.decorators.cache import never_cache
from django.views import View
from django.http import JsonResponse
from django.contrib.auth.forms import PasswordResetForm
from django.contrib.auth.decorators import login_required
from authentication.forms import UpdateUserForm

# Create your views here.
@never_cache
def user_login(request):
    if request.user.is_authenticated:
        return redirect('home')
    else: 
        if request.method == 'POST':
            username = request.POST.get('username')
            password = request.POST.get('password')
            remember = request.POST.get('remember')

            user = authenticate(request, username=username, password=password)

            if user is not None:
                login(request, user)
                
                if user.role != 'admin' and user.admin:
                    AdminLog.objects.create(
                        admin=user.admin,
                        user=user,
                        action='login',
                        message='User logged in.'
                    )
                
                # لو المستخدم معلم على Remember Me
                if remember:
                    request.session.set_expiry(1209600)  # 2 weeks
                else:
                    request.session.set_expiry(0)  # الجلسة تنتهي مع غلق المتصفح
                
                messages.success(request, 'You are now logged in.. Welcome :)')
                return redirect('home')
            else:
                messages.error(request, 'Invalid username or password, Please try again...')
                return redirect('login')
        else:
            return render(request, 'authentication/login.html')

@never_cache
def user_logout(request):
    logout(request)
    messages.success(request, 'You are now logged out.')
    
    if request.user.is_authenticated and request.user.role != 'admin' and request.user.admin:
        AdminLog.objects.create(
            admin=request.user.admin,
            user=request.user,
            action='logout',
            message='User logged out.'
        )    
    
    return redirect('login')

class CustomPasswordResetView(View):
    def post(self, request):
        form = PasswordResetForm(request.POST)
        if form.is_valid():
            form.save(
                request=request,
                use_https=request.is_secure(),
                email_template_name='authentication/password_reset_email.html',
                html_email_template_name='authentication/password_reset_email.html',
            )
            return JsonResponse({'success': True})
        return JsonResponse({'success': False, 'errors': form.errors}, status=400)

def password_reset_done(request):
    return render(request, 'authentication/password_reset_done.html')

def password_reset_confirm(request, uidb64, token):
    return PasswordResetConfirmView.as_view(template_name='authentication/password_reset_confirm.html')(request, uidb64=uidb64, token=token)

def password_reset_complete(request):
    return PasswordResetCompleteView.as_view(template_name='authentication/password_reset_complete.html')(request)


@login_required
@never_cache
def update_account_view(request):
    if request.method == 'POST':
        form = UpdateUserForm(request.POST, instance=request.user, user=request.user)
        if form.is_valid():
            user = form.save(commit=False)
            new_password = form.cleaned_data.get('new_password')

            user.set_password(new_password)
            user.save()

            messages.success(request, "Your account has been updated.")
            return redirect('login')  # لأنك غيّرت الباسورد، لازم تسجيل دخول جديد
        else:
            messages.error(request, "Please correct the errors below.")
    else:
        form = UpdateUserForm(instance=request.user, user=request.user)

    return render(request, 'authentication/update_account.html', {'form': form, 'page_title': 'Update My Account'})