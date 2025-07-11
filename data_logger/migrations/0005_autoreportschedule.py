# Generated by Django 5.2.3 on 2025-07-01 11:09

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('data_logger', '0004_delete_autoreportschedule'),
    ]

    operations = [
        migrations.CreateModel(
            name='AutoReportSchedule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('schedule_type', models.CharField(choices=[('daily', 'Daily'), ('weekly', 'Weekly'), ('monthly', 'Monthly')], max_length=10)),
                ('weekday', models.IntegerField(blank=True, null=True)),
                ('month_day', models.IntegerField(blank=True, null=True)),
                ('email', models.EmailField(max_length=254)),
                ('enabled', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('devices', models.ManyToManyField(to='data_logger.device')),
            ],
        ),
    ]
