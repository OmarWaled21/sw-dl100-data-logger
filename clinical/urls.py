from django.urls import path
from . import views

urlpatterns = [
    path('', views.home_view, name='clinical'),
    # Volunteer Screening Management
    path('volunteers/', views.all_volunteers_view, name='all_volunteers'),
    path('volunteer/register/', views.volunteer_form, name='register_volunteer'),
    path('volunteer/edit/<str:volunteer_id>/', views.volunteer_form, name='edit_volunteer'),
    path('volunteer/<str:volunteer_id>/sign/', views.sign_pdf_page, name='sign_pdf_page'),
    path('volunteer/<str:volunteer_id>/sign/submit/', views.submit_signature, name='submit_signature'),
    path('volunteer/<str:volunteer_id>/confirm/', views.confirm_pdf, name='confirm_pdf'),
    path('volunteer/<str:volunteer_id>/confirm_signature/', views.confirm_signature, name='confirm_signature'),
    path('volunteer/<str:volunteer_id>/delete/', views.delete_volunteer, name='delete_volunteer'),
    # Study Master File Management
    path('studies/', views.study_list, name='study_list'),
    path('study/create/', views.study_form, name='create_study'),
    path('study/edit/<str:study_code>/', views.study_form, name='edit_study'),
    path('suggest-code/', views.suggest_study_code, name='suggest_study_code'),
    path('studies/<str:study_code>/delete/', views.delete_study, name='delete_study'),
    path('studies/<str:study_code>/view-pdf/', views.view_study_pdf, name='view_pdf'),
    path('study/<str:study_code>/start/', views.start_study, name='start_study'),
    path('study/<str:study_code>/end/', views.end_study, name='end_study'),
    # Study Enrollments Management
    path('enroll-volunteer/', views.enroll_volunteer, name='enroll_volunteer'),
    path('submit-enrollment-signature/', views.submit_enrollment_signature, name='submit_enrollment_signature'),
    path('studies/<str:study_code>/volunteers/', views.study_volunteers, name='study_volunteers'),
    path('delete-enrollment/<int:enrollment_id>/', views.delete_enrollment, name='delete_enrollment'),
]
