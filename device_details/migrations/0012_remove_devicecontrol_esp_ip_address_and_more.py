# Generated by Django 5.2.3 on 2025-07-09 18:47

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('device_details', '0011_devicecontrol_esp_ip_address'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='devicecontrol',
            name='esp_ip_address',
        ),
        migrations.AddField(
            model_name='devicecontrol',
            name='confirmation_deadline',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='devicecontrol',
            name='pending_confirmation',
            field=models.BooleanField(default=False),
        ),
    ]
