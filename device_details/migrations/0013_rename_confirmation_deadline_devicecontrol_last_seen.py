# Generated by Django 5.2.3 on 2025-07-10 12:55

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('device_details', '0012_remove_devicecontrol_esp_ip_address_and_more'),
    ]

    operations = [
        migrations.RenameField(
            model_name='devicecontrol',
            old_name='confirmation_deadline',
            new_name='last_seen',
        ),
    ]
