from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import json
def generate_report_for_result(result, out_path):
    c = canvas.Canvas(out_path, pagesize=letter)
    width, height = letter
    c.setFont('Helvetica-Bold', 16)
    c.drawString(40, height-60, "Parkinson's Voice Analysis Report")
    c.setFont('Helvetica', 12)
    c.drawString(40, height-90, f"User: {result.get('user', 'N/A')}")
    c.drawString(40, height-110, f"Date: {result.get('created_at', 'N/A')}")
    c.drawString(40, height-140, f"Label: {result.get('label', 'N/A')}")
    c.drawString(40, height-160, f"Score: {result.get('score', 'N/A')}")
    c.drawString(40, height-200, "Features (truncated):")
    features = result.get('features', {})
    text = json.dumps(features, indent=2)[:1200]
    text_y = height-220
    for line in text.splitlines():
        c.drawString(40, text_y, line)
        text_y -= 14
        if text_y < 40:
            c.showPage()
            text_y = height-40
    c.save()

if __name__ == '__main__':
    sample = {'user':'demo','created_at':'now','label':'Healthy','score':0.23,'features':{'jitter':0.01,'shimmer':0.02}}
    generate_report_for_result(sample, 'sample_report.pdf')
