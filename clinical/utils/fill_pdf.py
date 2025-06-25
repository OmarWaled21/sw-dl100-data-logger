import fitz  # PyMuPDF

def fill_pdf_data(volunteer, input_path, output_path):
    doc = fitz.open(input_path)
    
    for page in doc:
        for field in page.widgets():
            print("Found field:", field.field_name)
            if field.field_name == "name":
                text = f"{volunteer.first_name} {volunteer.last_name}"
                rect = field.rect  # الحصول على موقع الحقل
                # تعديل موضع الإدراج لأسفل قليلاً
                page.insert_text((rect.x0, rect.y0 + 10), text, fontsize=12)  # إدراج النص في الموقع
            elif field.field_name == "national_id":
                text = volunteer.national_id
                rect = field.rect
                page.insert_text((rect.x0, rect.y0 + 10), text, fontsize=12)
            elif field.field_name == "birth_date":
                text = volunteer.birth_date.strftime("%Y-%m-%d")
                rect = field.rect
                page.insert_text((rect.x0, rect.y0 + 10), text, fontsize=12)
            elif field.field_name == "phone":
                text = volunteer.phone_number
                rect = field.rect
                page.insert_text((rect.x0, rect.y0 + 10), text, fontsize=12)

            # حذف الحقل القابل للتعديل إذا لم يكن حقل التوقيع
            if field.field_name != "signature":
                page.delete_widget(field)

    # حفظ الملف
    doc.save(output_path, deflate=True, garbage=3)
    doc.close()
