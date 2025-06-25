from django.contrib import admin
from django.conf import settings
from .models import Volunteer, StudyVolunteer, Study
from django.apps import apps

CustomUser = apps.get_model(settings.AUTH_USER_MODEL)

class StudyAdmin(admin.ModelAdmin):
    filter_horizontal = ('assigned_staffs',)

    def formfield_for_manytomany(self, db_field, request, **kwargs):
        if db_field.name == "assigned_staffs":
            kwargs["queryset"] = CustomUser.objects.filter(
                categories__name__iexact='clinical'
            ).distinct()
        return super().formfield_for_manytomany(db_field, request, **kwargs)

admin.site.register(Volunteer)
admin.site.register(Study, StudyAdmin)
admin.site.register(StudyVolunteer)
