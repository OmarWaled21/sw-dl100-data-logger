# Generated by Django 5.2.1 on 2025-05-24 22:36

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0001_initial'),
        ('home', '0003_alter_category_slug'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='category',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='users', to='home.category'),
        ),
    ]
