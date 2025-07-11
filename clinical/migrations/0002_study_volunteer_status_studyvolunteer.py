# Generated by Django 5.2.1 on 2025-05-25 19:02

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('clinical', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Study',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('study_code', models.CharField(max_length=100, unique=True)),
                ('date', models.DateField()),
                ('status', models.CharField(choices=[('Created', 'Created'), ('In-Progress', 'In-Progress'), ('Finalized', 'Finalized')], default='Created', max_length=20)),
                ('assigned_to', models.CharField(max_length=255)),
            ],
        ),
        migrations.AddField(
            model_name='volunteer',
            name='status',
            field=models.CharField(choices=[('new', 'New'), ('signed', 'Signed'), ('edited', 'Edited')], default='new', max_length=10),
        ),
        migrations.CreateModel(
            name='StudyVolunteer',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('study_code', models.CharField(max_length=100)),
                ('status', models.CharField(default='incomplete', max_length=50)),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('volunteer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='clinical.volunteer')),
            ],
            options={
                'unique_together': {('volunteer', 'study_code')},
            },
        ),
    ]
