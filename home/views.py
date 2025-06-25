from pyexpat.errors import messages
from django.shortcuts import get_object_or_404, render, redirect

from data_logger.utils import get_master_time
from .models import Category

def home(request):
    user = request.user
    
    if not user.is_authenticated:
        return redirect('login')  # لو مش مسجل دخول
    
    user_categories = user.categories.all()
    
    if not user_categories.exists():
        messages.error(request, "You don't have permission to access any category. Please contact admin.")
        return redirect('login')
    
    master_time = get_master_time()
    
    if user_categories.count() == 1:
        # لو عنده category واحد، حوله على صفحة هذي الكاتيجوري مباشرة
        category = user_categories.first()
        # مثلاً نفترض عندك صفحة عرض للكاتيجوري برابط اسمه 'category_detail' يأخذ slug
        return redirect(f'/{category.slug}/')
    else:
        # لو عنده أكثر من category أو مفيش يعرض صفحة القوائم عادي
        categories = user_categories  # او Category.objects.all() لو عايز تعرض الكل
        return render(request, 'home/home.html', {
            'categories': categories,
            'current_time': master_time,
            'page_title': 'Categories',
        })


def category_detail(request, slug):
    try:
        category = Category.objects.get(slug=slug)
    except Category.DoesNotExist:
        # هنا لو مش موجود slug، اعمل redirect مثلاً للصفحة الرئيسية أو لأي صفحة تختارها
        return redirect(slug)  # غير 'home' لأي رابط تريده
    # عرض تفاصيل الكاتيجوري، أو الصفحه المخصصة لها
    return render(request, 'home/category_detail.html', {
        'category': category,
    })