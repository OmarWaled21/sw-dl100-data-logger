import base64
import os
from io import BytesIO
import fitz
from PIL import Image
import tempfile

def add_signature_to_pdf(volunteer_id, signature_base64, pdf_path):
    doc = fitz.open(pdf_path)

    image_data = base64.b64decode(signature_base64.split(",")[1])
    image_stream = BytesIO(image_data)
    pil_image = Image.open(image_stream).convert("RGBA")

    # استخدم TemporaryDirectory بدلاً من NamedTemporaryFile
    with tempfile.TemporaryDirectory() as tmpdirname:
        temp_img_path = os.path.join(tmpdirname, "signature.png")
        pil_image.save(temp_img_path, format="PNG")

        img = fitz.Pixmap(temp_img_path)

        for page in doc:
            widgets = page.widgets()
            if not widgets:
                continue
            for widget in widgets:
                if widget.field_name == "signature":
                    rect = widget.rect
                    page.insert_image(rect, pixmap=img)
                    page.delete_widget(widget)

    doc.save(pdf_path, incremental=True, encryption=fitz.PDF_ENCRYPT_KEEP)
