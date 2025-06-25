from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from authentication.models import CustomUser
from home.models import Category
from .forms import AddUserForm, EditUserForm 

@login_required
def my_users(request):
    if request.user.role != 'admin':
        return redirect('home')
    
    users = CustomUser.objects.filter(admin=request.user)
    categories = Category.objects.all() 

    return render(request, 'users/my_users.html', {'users': users, 'page_title': 'My Users', 'categories': categories,})



@login_required
def edit_user(request, user_id):
    user = get_object_or_404(CustomUser, id=user_id, admin=request.user)
    
    if request.method == 'POST':
        form = EditUserForm(request.POST, instance=user)
        if form.is_valid():
            if form.cleaned_data['categories'].count() == 0:
                form.add_error('categories', 'Please select at least one category.')
            else:
                form.save()
                return redirect('my_users')
    else:
        form = EditUserForm(instance=user)
    return redirect('my_users')


@login_required
def delete_user(request, user_id):
    user = get_object_or_404(CustomUser, id=user_id, admin=request.user)
    
    if request.method == 'POST':
        user.delete()
        return redirect('my_users')
    
    return render(request, 'confirm_delete.html', {'user_obj': user})

@login_required
def add_user(request):
    if request.user.role != 'admin':
        return redirect('home')
    
    admin_categories = request.user.categories.all()
    admin_category_count = admin_categories.count()

    default_category_id = ''
    if admin_category_count == 1:
        default_category_id = str(admin_categories.first().id)

    if request.method == 'POST':
        form = AddUserForm(request.POST)
        categories_ids = request.POST.get('categories', '').split(',')
        if form.is_valid():
            user = form.save(commit=False)
            user.set_password(form.cleaned_data['password'])
            user.admin = request.user
            user.save()
            if categories_ids and categories_ids != ['']:
                user.categories.set(categories_ids)
            messages.success(request, 'User added successfully!')
            return redirect('home')
        else:
            for field, errors in form.errors.items():
                for error in errors:
                    if field == 'categories' and 'is not a valid value' in error:
                        messages.error(request, "You must choose at least one category.")
                    else:
                        messages.error(request, f"{field}: {error}")
    else:
        form = AddUserForm()

    return render(request, 'users/add_user.html', {
        'form': form,
        'page_title': 'Add User',
        'categories': admin_categories,
        'admin_category_count': admin_category_count,
        'default_category_id': default_category_id,  # ⬅ نمرر القيمة هنا
    })
