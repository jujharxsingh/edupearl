"""
==============================================================================
Edupearl Immigration Services & Language Point
PowerPoint Presentation Generator (python-pptx)
==============================================================================
Target: BCA Final Year Field Project Presentation & Viva Defense
Output: D:\\Projects\\Edupearl\\documentation\\field-project-presentation\\Edupearl_Field_Project_Presentation.pptx
Format: 16:9 Widescreen (13.333 x 7.5 inches)
==============================================================================
"""

import os
import sys
from PIL import Image
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

OUTPUT_DIR = r"D:\Projects\Edupearl\documentation\field-project-presentation"
SCREENSHOTS_DIR = r"D:\Projects\Edupearl\documentation\presentation-screenshots"
OUTPUT_PPTX = os.path.join(OUTPUT_DIR, "Edupearl_Field_Project_Presentation.pptx")

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ----------------------------------------------------------------------------
# Theme Color Palette (Edupearl Academic Design)
# ----------------------------------------------------------------------------
NAVY_HEADER = RGBColor(15, 23, 42)     # #0F172A - Deep Navy
BLUE_ACCENT = RGBColor(30, 58, 138)    # #1E3A8A - Royal Blue
CRIMSON     = RGBColor(158, 27, 50)    # #9E1B32 - Edupearl Crimson
GOLD_AMBER  = RGBColor(217, 119, 6)    # #D97706 - Warm Amber/Gold
SLATE_BODY  = RGBColor(51, 65, 85)     # #334155 - Slate Dark Body Text
SLATE_MUTED = RGBColor(100, 116, 139)  # #64748B - Muted Gray
BG_CARD     = RGBColor(248, 250, 252)  # #F8FAFC - Off-white card background
BORDER_GRAY = RGBColor(226, 232, 240)  # #E2E8F0 - Subtle border
WHITE       = RGBColor(255, 255, 255)  # Pure White
SUCCESS_GRN = RGBColor(16, 185, 129)   # Emerald Green

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
blank_layout = prs.slide_layouts[6]

def add_header(slide, tag_text, title_text, subtitle_text):
    """Adds a standard academic header banner to a content slide."""
    # Top Tag / Category Pill
    tag_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(8), Inches(0.35))
    tf_tag = tag_box.text_frame
    tf_tag.word_wrap = True
    p_tag = tf_tag.paragraphs[0]
    p_tag.text = tag_text.upper()
    p_tag.font.size = Pt(9.5)
    p_tag.font.bold = True
    p_tag.font.color.rgb = CRIMSON

    # Main Slide Title
    title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.68), Inches(11.5), Inches(0.6))
    tf_title = title_box.text_frame
    tf_title.word_wrap = True
    p_title = tf_title.paragraphs[0]
    p_title.text = title_text
    p_title.font.size = Pt(20)
    p_title.font.bold = True
    p_title.font.color.rgb = NAVY_HEADER

    # Subtitle / Context description
    sub_box = slide.shapes.add_textbox(Inches(0.8), Inches(1.22), Inches(11.5), Inches(0.4))
    tf_sub = sub_box.text_frame
    tf_sub.word_wrap = True
    p_sub = tf_sub.paragraphs[0]
    p_sub.text = subtitle_text
    p_sub.font.size = Pt(11)
    p_sub.font.color.rgb = SLATE_MUTED

    # Header Divider Line
    line = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE,
        Inches(0.8), Inches(1.6), Inches(11.733), Inches(0.02)
    )
    line.fill.solid()
    line.fill.fore_color.rgb = BORDER_GRAY
    line.line.color.rgb = BORDER_GRAY

def add_footer(slide, slide_num, total_slides=18):
    """Adds standard footer to slide."""
    foot_box = slide.shapes.add_textbox(Inches(0.8), Inches(7.05), Inches(11.733), Inches(0.3))
    tf_foot = foot_box.text_frame
    p_foot = tf_foot.paragraphs[0]
    p_foot.text = f"Edupearl Immigration Services & Language Point • BCA Field Project Presentation • Slide {slide_num} of {total_slides}"
    p_foot.font.size = Pt(8.5)
    p_foot.font.color.rgb = SLATE_MUTED

def set_speaker_notes(slide, notes_text):
    """Sets speaker notes for the slide."""
    slide.notes_slide.notes_text_frame.text = notes_text.strip()

def fit_picture_in_box(slide, image_filename, box_left, box_top, box_w, box_h, caption_text=""):
    """Places an image proportionally centered inside a bounded container card."""
    img_path = os.path.join(SCREENSHOTS_DIR, image_filename)
    if not os.path.exists(img_path):
        return

    # Draw container background card
    card = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE,
        box_left, box_top, box_w, box_h
    )
    card.fill.solid()
    card.fill.fore_color.rgb = BG_CARD
    card.line.color.rgb = BORDER_GRAY
    card.line.width = Pt(1)

    # Read image dimensions to preserve natural aspect ratio
    with Image.open(img_path) as im:
        orig_w, orig_h = im.size

    avail_w = box_w - Inches(0.3)
    avail_h = box_h - Inches(0.7)  # leave room for caption

    aspect = orig_w / orig_h
    target_aspect = avail_w / avail_h

    if aspect > target_aspect:
        # Width constrained
        final_w = avail_w
        final_h = avail_w / aspect
    else:
        # Height constrained
        final_h = avail_h
        final_w = avail_h * aspect

    img_left = box_left + (box_w - final_w) / 2
    img_top = box_top + Inches(0.15) + (avail_h - final_h) / 2

    slide.shapes.add_picture(img_path, img_left, img_top, width=final_w, height=final_h)

    # Add Figure Caption underneath
    if caption_text:
        cap_box = slide.shapes.add_textbox(box_left, box_top + box_h - Inches(0.45), box_w, Inches(0.35))
        tf_cap = cap_box.text_frame
        p_cap = tf_cap.paragraphs[0]
        p_cap.text = caption_text
        p_cap.font.size = Pt(9)
        p_cap.font.italic = True
        p_cap.font.color.rgb = SLATE_MUTED
        p_cap.alignment = PP_ALIGN.CENTER

# ============================================================================
# SLIDE 1: Title Slide
# ============================================================================
slide1 = prs.slides.add_slide(blank_layout)

# Background Accent Card
bg_shape = slide1.shapes.add_shape(
    MSO_SHAPE.RECTANGLE,
    Inches(0.6), Inches(0.6), Inches(12.133), Inches(6.3)
)
bg_shape.fill.solid()
bg_shape.fill.fore_color.rgb = WHITE
bg_shape.line.color.rgb = BORDER_GRAY
bg_shape.line.width = Pt(1.5)

# Top Color Bar
top_bar = slide1.shapes.add_shape(
    MSO_SHAPE.RECTANGLE,
    Inches(0.6), Inches(0.6), Inches(12.133), Inches(0.18)
)
top_bar.fill.solid()
top_bar.fill.fore_color.rgb = CRIMSON
top_bar.line.fill.background()

# Institution & Degree Eyebrow
tag1 = slide1.shapes.add_textbox(Inches(1.2), Inches(1.2), Inches(10), Inches(0.4))
p1 = tag1.text_frame.paragraphs[0]
p1.text = "BACHELOR OF COMPUTER APPLICATIONS (BCA) • FINAL YEAR FIELD PROJECT"
p1.font.size = Pt(11)
p1.font.bold = True
p1.font.color.rgb = BLUE_ACCENT

# Main Project Title
t1 = slide1.shapes.add_textbox(Inches(1.2), Inches(1.7), Inches(11), Inches(1.2))
pt1 = t1.text_frame.paragraphs[0]
pt1.text = "Edupearl Immigration Services & Language Point"
pt1.font.size = Pt(28)
pt1.font.bold = True
pt1.font.color.rgb = NAVY_HEADER

# Subtitle
st1 = slide1.shapes.add_textbox(Inches(1.2), Inches(2.7), Inches(11), Inches(0.8))
pst1 = st1.text_frame.paragraphs[0]
pst1.text = "Design, Full-Stack Architecture, Multi-Branch Routing, and Production Deployment of an Enterprise Education & Visa Management System"
pst1.font.size = Pt(14)
pst1.font.color.rgb = SLATE_BODY

# Info Metadata Grid (2 Cards)
info_card1 = slide1.shapes.add_shape(
    MSO_SHAPE.ROUNDED_RECTANGLE,
    Inches(1.2), Inches(3.8), Inches(5.2), Inches(2.2)
)
info_card1.fill.solid()
info_card1.fill.fore_color.rgb = BG_CARD
info_card1.line.color.rgb = BORDER_GRAY

tf_c1 = info_card1.text_frame
tf_c1.word_wrap = True
p_c1_h = tf_c1.paragraphs[0]
p_c1_h.text = "STUDENT & PROJECT PROFILE"
p_c1_h.font.size = Pt(10)
p_c1_h.font.bold = True
p_c1_h.font.color.rgb = CRIMSON

p_c1_b = tf_c1.add_paragraph()
p_c1_b.text = "• Candidate Name: Jujhar Singh\n• Program: Bachelor of Computer Applications\n• Academic Focus: Web Systems, Database Design & Full-Stack Engineering\n• Production URL: https://edupearl.onrender.com"
p_c1_b.font.size = Pt(10.5)
p_c1_b.font.color.rgb = SLATE_BODY

info_card2 = slide1.shapes.add_shape(
    MSO_SHAPE.ROUNDED_RECTANGLE,
    Inches(6.8), Inches(3.8), Inches(5.3), Inches(2.2)
)
info_card2.fill.solid()
info_card2.fill.fore_color.rgb = BG_CARD
info_card2.line.color.rgb = BORDER_GRAY

tf_c2 = info_card2.text_frame
tf_c2.word_wrap = True
p_c2_h = tf_c2.paragraphs[0]
p_c2_h.text = "TECHNOLOGY IMPLEMENTATION"
p_c2_h.font.size = Pt(10)
p_c2_h.font.bold = True
p_c2_h.font.color.rgb = BLUE_ACCENT

p_c2_b = tf_c2.add_paragraph()
p_c2_b.text = "• Backend: Node.js (v24 LTS) & Express.js (v5.3)\n• Database: MySQL 8.0 / TiDB Cloud Serverless (InnoDB)\n• Security: Bcrypt Password Hashing, JWT Auth, HttpOnly Cookies\n• Frontend: Semantic HTML5, Modular CSS3, Vanilla ES6+ JS"
p_c2_b.font.size = Pt(10.5)
p_c2_b.font.color.rgb = SLATE_BODY

set_speaker_notes(slide1, """
Respected examiners, good morning. Today, I am proud to present my BCA Final Year Field Project titled: 'Edupearl Immigration Services & Language Point: Website Development and Management System'.

Edupearl is a multi-branch educational and immigration consultancy operating across Punjab and Rajasthan. The goal of this project was to engineer a robust, complete full-stack web application that serves prospective international students through an intuitive public web portal while giving staff and super administrators a secure, real-time management dashboard to manage client enquiries, course offerings, and physical branches.

Throughout this project, I handled every stage: from requirement analysis and relational database modeling in MySQL, to REST API development in Express.js, security hardening using JWT and bcrypt, and finally live cloud deployment with SSL. Today, the system is 100% operational locally and live on the internet.
""")

# ============================================================================
# Helper: Standard 2-Column Content Slide with Screenshot
# ============================================================================
def create_two_column_slide(slide_num, tag, title, subtitle, bullets_data, image_file, caption, notes):
    slide = prs.slides.add_slide(blank_layout)
    add_header(slide, tag, title, subtitle)
    add_footer(slide, slide_num)

    # Left Column: Structured Cards / Content
    col_w = Inches(5.5)
    left_x = Inches(0.8)
    top_y = Inches(1.8)

    box = slide.shapes.add_textbox(left_x, top_y, col_w, Inches(5.0))
    tf = box.text_frame
    tf.word_wrap = True

    for idx, item in enumerate(bullets_data):
        head = item.get("header", "")
        body = item.get("body", "")
        p_h = tf.paragraphs[0] if idx == 0 else tf.add_paragraph()
        p_h.text = f"{idx+1}. {head}" if item.get("numbered", True) else head
        p_h.font.size = Pt(12)
        p_h.font.bold = True
        p_h.font.color.rgb = BLUE_ACCENT
        p_h.space_before = Pt(8) if idx > 0 else Pt(0)

        p_b = tf.add_paragraph()
        p_b.text = body
        p_b.font.size = Pt(10)
        p_b.font.color.rgb = SLATE_BODY
        p_b.space_before = Pt(2)

    # Right Column: Fitted Screenshot
    fit_picture_in_box(
        slide,
        image_file,
        Inches(6.6), Inches(1.8), Inches(5.9), Inches(5.0),
        caption
    )

    set_speaker_notes(slide, notes)
    return slide

# ============================================================================
# SLIDE 2: Problem Statement & Objectives
# ============================================================================
create_two_column_slide(
    2,
    "Background & Motivation",
    "2. Problem Statement & Project Objectives",
    "Addressing real-world consultancy workflow bottlenecks through centralized software engineering.",
    [
        {
            "header": "Fragmented Inquiries & Lead Loss",
            "body": "Consultancy branches previously tracked prospective students through paper logs and disparate WhatsApp chats, leading to lost inquiries and delayed student follow-ups."
        },
        {
            "header": "Lack of Multi-Branch Visibility",
            "body": "Management had no unified view of walk-in inquiries or batch registrations across multiple training centers (Ludhiana, Jagraon, Hathur, Kapurthala, etc.)."
        },
        {
            "header": "Core Engineering Objectives",
            "body": "Build a responsive, high-speed public web portal; establish an automated lead capture pipeline with branch assignment; and enforce role-based administrative control with MySQL persistence."
        },
        {
            "header": "Quality & Security Benchmark",
            "body": "Eliminate hardcoded secrets, protect student contact privacy, enforce rate limits against spam bots, and ensure 100% cloud deployment availability."
        }
    ],
    "02-homepage-overview.png",
    "Figure 2.1: Edupearl Core Offerings & System Positioning Overview",
    """
In this slide, I highlight the problem statement that motivated this project.
During my field inspection, I found that immigration and language preparation institutes handle hundreds of prospective students daily. Without a unified system, inquiries received over telephone or walk-ins are easily misplaced or neglected. Furthermore, head office managers could not monitor counseling activities across regional branches.

To solve this, I designed the Edupearl system with three primary objectives:
First, provide prospective students with an informative, responsive web portal where they can explore IELTS/PTE courses and visa consultation offerings.
Second, implement an automated enquiry acquisition pipeline that routes leads directly to their preferred branch with tracking codes.
Third, provide administrators with a secure, role-based CRM dashboard to track every lead from 'new' to 'converted'.
"""
)

# ============================================================================
# SLIDE 3: Technologies Used
# ============================================================================
create_two_column_slide(
    3,
    "Technology Stack",
    "3. Full-Stack Technology Stack & Architecture Rationale",
    "Carefully selected industry-standard tools delivering speed, maintainability, and zero bloat.",
    [
        {
            "header": "Client-Side Frontend Layer",
            "body": "HTML5 semantic structure, modern CSS3 custom properties with mobile-first media queries, and vanilla JavaScript (ES6+). Zero heavy frameworks (React/Angular) ensures instant load times (<1s) and low memory usage."
        },
        {
            "header": "Backend Runtime & Application Framework",
            "body": "Node.js (v24 LTS) with Express.js (v5.3). Asynchronous event-driven non-blocking I/O allows the server to efficiently process high concurrent lead submissions and REST API requests."
        },
        {
            "header": "Persistent Relational Database Tier",
            "body": "MySQL 8.0 & TiDB Cloud Serverless using the InnoDB storage engine. Promises-based connection pooling (mysql2/promise) ensures persistent connections, foreign key enforcement, and ACID compliance."
        },
        {
            "header": "Security & Deployment Infrastructure",
            "body": "Bcrypt.js (12 salt rounds) for password hashing; JSON Web Tokens (JWT) inside HttpOnly/SameSite=Lax cookies; Render.com web service with automated HTTPS/TLS encryption."
        }
    ],
    "10-admin-login.png",
    "Figure 3.1: Administrative Authentication Interface Demonstrating Secure JWT Handshake",
    """
Here is our technology stack breakdown.
For the frontend, I chose semantic HTML5 and vanilla JavaScript rather than a heavy single-page framework like React or Angular. This keeps the initial page weight minimal, ensures high Lighthouse performance scores, and allows complete control over DOM rendering and animations.

On the server side, I chose Node.js with Express 5. Express provides a clean middleware architecture for CORS, JSON body parsing, and route protection.

For data storage, I selected MySQL 8.0 and TiDB Serverless. Both use the standard MySQL wire protocol. Rather than opening a new TCP connection on every query, we use connection pooling with mysql2/promise, which recycles active connections and drastically reduces query latency.

For security, passwords are encrypted using bcrypt with 12 salt rounds, and sessions are authorized via JWT stored in HttpOnly, secure cookies.
"""
)

# ============================================================================
# SLIDE 4: Website Structure & Functional Modules
# ============================================================================
create_two_column_slide(
    4,
    "Modular Architecture",
    "4. Website Structure & Functional Modules",
    "Clear separation between public candidate services and administrative management subsystems.",
    [
        {
            "header": "Public Marketing & Counseling Subsystem",
            "body": "• Homepage (/): Hero video branding, program highlights, student success proofs.\n• Courses (/courses.html): IELTS Academic/General, PTE AI software lab, Spoken English.\n• Services (/services.html): Study permits, tourist visas, post-study work permits."
        },
        {
            "header": "Multi-Branch & Discovery Module",
            "body": "• Branch Directory (/branches.html): Complete office locations, addresses, direct calls.\n• Center Selection (/select-branch.html): Interactive location picker with live keyword filter."
        },
        {
            "header": "Enquiry & Lead Acquisition Desk",
            "body": "• Contact Page (/contact.html): Lead capture form with anti-spam honeypot, country routing, and dynamic branch selection."
        },
        {
            "header": "Administrative CRM Subsystem",
            "body": "• Role-Protected Portal (/admin/): Protected Dashboard, Enquiry Management, Services Editor, Branch Management, and Session Guard."
        }
    ],
    "01-homepage.png",
    "Figure 4.1: Public Homepage Hero Section & Unified Navigation Structure",
    """
This slide outlines the organizational structure of the web application.
The system is divided into two distinct environments:

The Public Portal, which prospective students and parents visit. It contains dedicated pages for IELTS/PTE course curriculums, immigration visa offerings, branch locations, and an online enquiry desk.

The second environment is the Administrative Portal located under /admin/. This section is strictly protected. Only authorized staff members can enter. It provides full CRUD operations for branch offices, course listings, and an enquiry tracking workflow where counselors review candidate profiles, add interview notes, and transition inquiry statuses.
"""
)

# ============================================================================
# SLIDE 5: Public Website Interface & Brand Identity
# ============================================================================
create_two_column_slide(
    5,
    "User Interface",
    "5. Public Website Interface & User Experience",
    "Engaging, high-conversion visual design tailored for students aspiring to study abroad.",
    [
        {
            "header": "Design Aesthetic & Color Hierarchy",
            "body": "Built using Edupearl's established visual identity: deep navy header navigation, royal blue accents, ruby/crimson action highlights, and clean typography with accessible contrast ratios."
        },
        {
            "header": "Interactive Dynamic Components",
            "body": "• Looping background 3D globe animation representing international migration.\n• Floating pill-shaped header with instant WhatsApp and Instagram shortcuts.\n• Live student visa grant and IELTS scorecard result gallery."
        },
        {
            "header": "Performance & Accessibility Optimizations",
            "body": "All images and poster thumbnails are optimized. Scripts use modern deferred loading. Form controls feature explicit ARIA labels and keyboard focus outlines."
        },
        {
            "header": "Zero Framework Dependencies",
            "body": "Eliminates render-blocking third-party UI libraries like Bootstrap or Tailwind, ensuring swift delivery even on mobile networks across regional centers."
        }
    ],
    "16-student-success-results.png",
    "Figure 5.1: Real Student Visa Grants & IELTS Success Showcase Gallery",
    """
Now let's examine the public website user interface.
When designing the interface, our focus was credibility and conversion. International education is a high-trust decision. We incorporated authentic visa approval showcases and test scorecards directly onto the homepage.

The navigation bar features a modern pill container with quick actions for WhatsApp and Instagram, allowing immediate candidate engagement.

Critically, the entire frontend was developed without heavy CSS frameworks like Bootstrap or Tailwind. By using clean CSS custom properties and flexbox/grid layouts, we achieved a unique, branded look with ultra-fast page load times and perfect responsiveness across mobile, tablet, and desktop devices.
"""
)

# ============================================================================
# SLIDE 6: Services and Courses Management
# ============================================================================
create_two_column_slide(
    6,
    "Core Offerings",
    "6. Services & Courses: Dynamic Catalog Architecture",
    "Decoupled data model delivering tailored curriculums and visa advisory programs.",
    [
        {
            "header": "Language Proficiency Preparation Courses",
            "body": "• IELTS Academic & General: 8-week structured modules covering Reading, Writing, Listening, Speaking with weekly mock tests.\n• PTE Academic Training: 6-week computer-lab intensive coaching focused on AI scoring.\n• Spoken English: 4-week conversation and fluency enhancement."
        },
        {
            "header": "Immigration & Visa Advisory Tracks",
            "body": "• Study Visa Filing: University selection, SOP structuring, financial documentation.\n• Visitor & Tourist Visas: Case-by-case advisory and travel itinerary compliance.\n• Post-Study Work Permit: Transitional rights counseling following graduation."
        },
        {
            "header": "Dynamic REST API Delivery",
            "body": "All course data is served via GET /api/services with category filters (?category=language_course / ?category=immigration_service), ensuring seamless maintenance from the database."
        }
    ],
    "03-services-page.png",
    "Figure 6.1: Immigration & Visa Services Directory with Filter Navigation",
    """
Slide 6 details our educational and visa consulting catalog.
We offer two distinct categories: Language Coaching and Visa Advisory.

Under Language Courses, we provide IELTS Academic, PTE Academic, and Spoken English.
Under Immigration Services, we guide candidates on Study Permits for Canada, UK, Australia, and Europe, as well as Visitor Visas and Post-Study Work Permits.

On the technical side, these offerings are stored in the 'services_courses' table in MySQL. When a user opens /services.html or /courses.html, the frontend fetches data asynchronously from GET /api/services. If an administrator adds a new course or changes a duration in the admin panel, the public website updates instantly without touching any HTML files.
"""
)

# ============================================================================
# SLIDE 7: Branch Directory & Multi-Center Routing
# ============================================================================
create_two_column_slide(
    7,
    "Multi-Branch System",
    "7. Multi-Branch Directory & Location Routing",
    "Connecting prospective students directly to their nearest physical training facility.",
    [
        {
            "header": "Physical Branch Network",
            "body": "Edupearl operates across 6 locations: Head Office (Ludhiana), Jagraon, Hathur, Sri Ganganagar, Kapurthala, and Mullanpur Dakha."
        },
        {
            "header": "Branch Selection Portal (/select-branch.html)",
            "body": "Interactive directory allowing students to choose their preferred center. Includes real-time keyword search filtering by city, name, or center code."
        },
        {
            "header": "Client-Side Preference Persistence",
            "body": "The selected branch ID and metadata are stored in localStorage and cookie storage. Subsequent inquiry forms automatically pre-select the user's nearest center."
        },
        {
            "header": "Relational Routing Benefit",
            "body": "Guarantees student inquiries are not lost in an ambiguous queue; leads are routed directly to counselors operating in that physical territory."
        }
    ],
    "06-branch-directory.png",
    "Figure 7.1: Physical Branch Offices & Regional Centers Directory",
    """
A standout feature of this project is our Multi-Branch Directory and routing mechanism.
Edupearl operates six physical branches across Punjab and Rajasthan.
To connect visitors with their nearest branch, we created both a public directory at /branches.html and an interactive Center Selection portal at /select-branch.html.

Visitors can search by city or center name. When a user selects a center, the system saves their choice in local storage and cookies. Later, when they submit an inquiry, the form automatically pre-assigns that specific branch. This prevents leads from getting stuck in an unassigned backlog and ensures regional counselors can respond immediately.
"""
)

# ============================================================================
# SLIDE 8: Enquiry Form & Lead Acquisition
# ============================================================================
create_two_column_slide(
    8,
    "Lead Acquisition",
    "8. Enquiry Form & Client Data Capture",
    "Frictionless, accessible lead generation protected by multi-layer anti-spam security.",
    [
        {
            "header": "Comprehensive Information Fields",
            "body": "Captures Candidate Name, Validated Email, Phone Number, City, Target Study Destination, Area of Interest, Preferred Branch, and In-depth Inquiry Notes."
        },
        {
            "header": "Client-Side Form Validation",
            "body": "HTML5 pattern validation and JavaScript constraint checks prevent empty or malformed submissions before sending an HTTP payload."
        },
        {
            "header": "Invisible Honeypot Anti-Spam Protection",
            "body": "Contains an off-screen honeypot field (_hp) hidden from legitimate human users. Automated spam bots fill all fields, allowing the backend to silently intercept and neutralize bot spam."
        },
        {
            "header": "Unique Reference Code Generation",
            "body": "Upon successful database insertion, the system generates a unique reference code (e.g. ENQ-2026-XXXX) returned to the student for status tracking."
        }
    ],
    "08-enquiry-form.png",
    "Figure 8.1: Public Lead Enquiry Desk Form with Multi-Field Validation",
    """
In Slide 8, we look at the Enquiry Form.
This is the primary conversion tool on the website. Located on /contact.html and accessible throughout the site, it captures candidate details including email, phone, target country, and preferred branch.

To protect the server against spam bots without frustrating legitimate users with difficult Captchas, I implemented an invisible Honeypot field. Legitimate users cannot see this hidden field, but automated bots detect and fill it. The server recognizes the honeypot submission and rejects it without saving it to the database.

Once a valid inquiry is submitted, the server generates a unique reference number formatted as ENQ-2026 followed by a hex tracking identifier.
"""
)

# ============================================================================
# SLIDE 9: Complete Enquiry Workflow
# ============================================================================
create_two_column_slide(
    9,
    "Business Workflow",
    "9. Complete Enquiry Lifecycle Workflow",
    "End-to-end trace from public student submission to counselor conversion.",
    [
        {
            "header": "Phase 1: Submission & Sanitization",
            "body": "Visitor submits form → POST /api/enquiries → Express rate-limiter check → Request body sanitization and XSS escaping."
        },
        {
            "header": "Phase 2: Database Persistence",
            "body": "Parameterized INSERT query executed on MySQL InnoDB pool. Foreign keys bind the lead to the chosen branch and course with ON DELETE SET NULL safeguard."
        },
        {
            "header": "Phase 3: Administrative Discovery",
            "body": "Lead immediately appears in Admin Dashboard KPI counters and the real-time Enquiry Management listing with 'New' status badge."
        },
        {
            "header": "Phase 4: Counselor Action & Conversion",
            "body": "Assigned counselor reviews candidate background, contacts the student via phone/WhatsApp, updates status ('in_progress' → 'contacted' → 'converted'), and logs interview notes."
        }
    ],
    "09-enquiry-validation.png",
    "Figure 9.1: Client-Side Form Validation Error Handling and Accessibility Feedback",
    """
Slide 9 illustrates the complete Enquiry Lifecycle from submission to conversion.
Let's trace a student inquiry through the system:

First, a prospective student enters their details on the website.
Second, the Express backend validates the payload, verifies telephone and email formats, checks IP rate limits, and strips any malicious scripts.
Third, a parameterized SQL INSERT creates the record in the 'enquiries' table with foreign keys linking to the branch and course.
Fourth, the administrator logs into the portal and sees the lead flagged as 'New'.
Fifth, the counselor contacts the candidate, adds consultation notes, and updates the status to 'Contacted' or 'Converted'.
This creates an auditable record of every student inquiry.
"""
)

# ============================================================================
# SLIDE 10: Multi-Tier Architecture & REST API Pipeline
# ============================================================================
create_two_column_slide(
    10,
    "System Architecture",
    "10. Multi-Tier System Architecture & RESTful API Pipeline",
    "Strict separation of concerns across presentation, routing, middleware, and persistence.",
    [
        {
            "header": "Three-Tier Architectural Decomposition",
            "body": "• Tier 1 (Presentation): HTML5/CSS3 client views & responsive Admin dashboard.\n• Tier 2 (Application/API): Node.js + Express 5 with modular controllers and middleware.\n• Tier 3 (Persistence): MySQL 8.0 InnoDB database with connection pooling."
        },
        {
            "header": "Express Middleware Processing Pipeline",
            "body": "Request Flow: Client Request → Rate Limiter (express-rate-limit) → Static File Server → JSON Body Parser → Cookie Parser → Auth Middleware (JWT verify) → Controller Handler → Database Query → JSON Response."
        },
        {
            "header": "Core REST API Endpoints",
            "body": "• GET /api/health & /api/health/db (System liveness & DB diagnostics)\n• GET /api/branches (Active branches catalog)\n• GET /api/services (Course catalog with filters)\n• POST /api/enquiries (Lead submission)\n• POST /api/auth/login & GET /api/admin/me (JWT Authentication)"
        }
    ],
    "07-branch-selection.png",
    "Figure 10.1: Interactive Center Selection Showing Real-Time Query Filter Response",
    """
This slide explains our software architecture for the viva examination.
The application strictly follows the classic Three-Tier Architectural Pattern:

The Presentation Tier handles user interaction in the browser.
The Application Tier is powered by Node.js and Express. It organizes our API endpoints and runs our middleware pipeline.
The Persistence Tier consists of MySQL with connection pooling.

When an HTTP request arrives, it travels through an organized middleware chain: First, rate limiting protects against abuse. Next, body and cookie parsers unpack the payload. Then, our authentication middleware verifies JWT signatures on protected routes. Finally, the controller executes parameterized SQL queries against MySQL and returns a structured JSON response.
"""
)

# ============================================================================
# SLIDE 11: Database Schema & Relational Integrity
# ============================================================================
create_two_column_slide(
    11,
    "Database Design",
    "11. Relational Database Schema & Integrity Guarantees",
    "Normalized 3NF relational model in MySQL 8.0 / TiDB Serverless (InnoDB).",
    [
        {
            "header": "Table 1: admins (Staff Credentials & RBAC)",
            "body": "Stores admin ID, username, email, password_hash (bcrypt), full_name, role ('super_admin', 'branch_admin', 'counselor'), is_active flag, and timestamps."
        },
        {
            "header": "Table 2: branches (Physical Centers)",
            "body": "Unique branch code (e.g. 01-LDH-HO), center name, address, city, state, postal code, phone, email, and is_active soft-delete flag."
        },
        {
            "header": "Table 3: services_courses (Catalog Offerings)",
            "body": "Slug identifier, category ('language_course' / 'immigration_service'), title, short/detailed descriptions, duration info, and display order."
        },
        {
            "header": "Table 4: enquiries (Student Leads)",
            "body": "Enquiry reference, candidate name, email, phone, city, target country, status ('new', 'in_progress', 'contacted', 'closed', 'converted'), counselor notes, IP address, and foreign keys."
        },
        {
            "header": "Relational Foreign Key Guarantee",
            "body": "enquiries references branches(id) and services_courses(id) with ON DELETE SET NULL, ensuring student historical records are never destroyed if a branch or course is retired."
        }
    ],
    "12-admin-enquiries.png",
    "Figure 11.1: Relational Enquiries Data Table Populated Directly from MySQL Database",
    """
Slide 11 covers our database schema design.
The database is named 'edupearl_db' and contains four normalized relational tables:

The 'admins' table stores staff credentials with roles for super_admin, branch_admin, and counselor.
The 'branches' table stores physical location details with unique codes like 01-LDH-HO.
The 'services_courses' table stores our academic courses and visa services.
The 'enquiries' table holds all incoming student leads.

Crucially, we enforce relational foreign key integrity. The enquiries table references both the branches table and services_courses table. We set 'ON DELETE SET NULL', meaning even if an old branch or course is deactivated, historical student enquiry records are permanently preserved for institutional reporting.
"""
)

# ============================================================================
# SLIDE 12: Admin Authentication & Security
# ============================================================================
create_two_column_slide(
    12,
    "System Security",
    "12. Administrative Authentication & Security Architecture",
    "Enterprise-grade defense mechanisms preventing unauthorized access and data breaches.",
    [
        {
            "header": "Cryptographic Password Protection (Bcrypt)",
            "body": "Passwords are never stored in plaintext. They are salted and hashed using bcryptjs with 12 calculation rounds, making hash inversion computationally infeasible."
        },
        {
            "header": "JWT Authentication via HttpOnly Cookies",
            "body": "Upon login, the server issues a signed JSON Web Token stored in an HttpOnly, Secure, SameSite=Lax cookie (edupearl_token). JavaScript cannot access the cookie, preventing XSS token theft."
        },
        {
            "header": "Brute-Force Login Rate Limiting",
            "body": "Authentication attempts are limited to 5 requests per 15-minute window per IP address. Exceeding attempts triggers an HTTP 429 Too Many Requests response."
        },
        {
            "header": "Role-Based Access Control (RBAC)",
            "body": "Super Administrators have full authority over branches and staff. Branch Admins and Counselors are restricted strictly to relevant candidate management."
        }
    ],
    "10-admin-login.png",
    "Figure 12.1: Admin Login Interface with Clean Autofill Handling & Password Toggle",
    """
Slide 12 explains our security architecture.
Securing administrative operations is essential. We implemented four layers of defense:

First, passwords are salted and hashed with bcrypt using 12 salt rounds. Even if database tables were exposed, passwords cannot be deciphered.
Second, upon successful authentication, the server generates a signed JSON Web Token and transmits it via an HttpOnly cookie. Because the cookie is marked HttpOnly, client-side JavaScript scripts cannot read it, entirely blocking Cross-Site Scripting token theft.
Third, brute-force protection is enforced using express-rate-limit, restricting login attempts to 5 per 15 minutes per IP address.
Fourth, we enforce Role-Based Access Control so counselors only see the data they are authorized to manage.
"""
)

# ============================================================================
# SLIDE 13: Admin Dashboard
# ============================================================================
create_two_column_slide(
    13,
    "Administrative Portal",
    "13. Administrator Management Dashboard",
    "Real-time operational dashboard providing bird's-eye metrics and system diagnostics.",
    [
        {
            "header": "Real-Time Key Performance Indicators (KPIs)",
            "body": "Displays live metrics cards: Total Student Enquiries, New Unassigned Leads, In-Progress Followups, and Converted Registrations."
        },
        {
            "header": "Automated System Health Monitoring",
            "body": "Embedded health monitor checks both API liveness (/api/health) and database connectivity (/api/health/db) in real time with visual status dots."
        },
        {
            "header": "Concurrent Metrics Aggregation",
            "body": "Frontend dashboard uses Promise.allSettled() to fetch health checks, counts, and recent enquiries concurrently without blocking the UI if an individual metric is slow."
        },
        {
            "header": "Role-Aware Navigation Sidebar",
            "body": "Dynamically reflects the authenticated admin's full name, email, and role badge (Super Admin / Counselor), hiding restricted modules from non-privileged users."
        }
    ],
    "11-admin-dashboard.png",
    "Figure 13.1: Authenticated Super Admin Dashboard with Live System Metrics",
    """
Here is the Admin Dashboard.
When an administrator logs in, this is their home screen. It gives management immediate operational visibility:

At the top, the welcome bar greets the authenticated administrator by name and displays their role badge.
Below, KPI metric cards display total inquiries, new inquiries awaiting contact, in-progress counseling cases, and total converted students.
The dashboard also features an automated system health monitor that pings both the Express API and MySQL database, confirming all subsystems are operational.

All dashboard metrics are fetched in parallel using Promise.allSettled(), ensuring that even if one component experiences latency, the rest of the dashboard renders smoothly without crashing.
"""
)

# ============================================================================
# SLIDE 14: Enquiry Management Portal
# ============================================================================
create_two_column_slide(
    14,
    "Lead Management",
    "14. Enquiry Management & Status Tracking Subsystem",
    "Full-featured CRM table for searching, filtering, and converting candidate leads.",
    [
        {
            "header": "Multi-Criteria Filtering & Search",
            "body": "Filter by keyword search (name, email, phone, reference code), lead status ('New', 'Contacted', 'Converted'), preferred branch, or service track."
        },
        {
            "header": "Interactive Detail Modal Dialog",
            "body": "Clicking any lead opens an accessible modal displaying complete contact info, target country, submission timestamp, and current status."
        },
        {
            "header": "Counselor Notes & Status Transition",
            "body": "Counselors log phone conversation outcomes directly into the counselor_notes field and update status via atomic PUT /api/enquiries/:id/status requests."
        },
        {
            "header": "Branch Reassignment",
            "body": "Leads can be seamlessly transferred to another branch if the student prefers attending classes at a different regional center."
        }
    ],
    "13-enquiry-status-management.png",
    "Figure 14.1: Interactive Enquiry Detail Modal Dialog with Status Transition Controls",
    """
Slide 14 demonstrates the Enquiry Management module in action.
This is the operational heart of the administrative system.

Administrators have access to a responsive data table showing all candidate leads. The table supports real-time search and multi-criteria filters: staff can filter by lead status, preferred branch, or specific visa track.

Clicking any row opens the interactive modal shown in Figure 14.1. Here, a counselor reviews the student's background, enters interview discussion notes, reassigns the lead to a different branch if requested, and updates the status from 'New' to 'In Progress', 'Contacted', or 'Converted'. Every status update is verified and saved atomically to MySQL.
"""
)

# ============================================================================
# SLIDE 15: Content & Master Data Administration
# ============================================================================
create_two_column_slide(
    15,
    "Master Data Management",
    "15. Services, Courses & Branch Master Data Management",
    "Administrative control over academic curriculums and multi-center location directory.",
    [
        {
            "header": "Services & Courses Administration (/admin/services.html)",
            "body": "Manage the offerings catalog: create new language batches (IELTS/PTE), update course descriptions, adjust durations, and toggle active status."
        },
        {
            "header": "Branch Management Subsystem (/admin/branches.html)",
            "body": "Full management of physical centers: update phone numbers, physical addresses, contact emails, and branch status flags."
        },
        {
            "header": "Soft-Deletion Architecture Policy",
            "body": "Neither branches nor services are hard-deleted. Setting is_active = FALSE hides them from public dropdowns while preserving historical inquiries."
        },
        {
            "header": "Audit Trail Timestamping",
            "body": "All record modifications automatically trigger MySQL TIMESTAMP ON UPDATE updates, providing an auditable trail of configuration changes."
        }
    ],
    "14-admin-services-courses.png",
    "Figure 15.1: Services & Courses Administration Portal for Catalog Management",
    """
Slide 15 covers our Master Data Management modules: Services & Courses Administration and Branch Management.

Through these interfaces, administrators can update physical office locations, change phone numbers, and update course curriculums.

I want to highlight our soft-deletion policy: in an enterprise system, you should never permanently delete a branch or course that has historical transactions attached to it. Instead of SQL DELETE queries, our system uses an 'is_active' boolean flag. Deactivating a course hides it from public visitors, but preserves all historical student inquiries attached to it in the database.
"""
)

# ============================================================================
# SLIDE 16: Testing & Quality Assurance
# ============================================================================
create_two_column_slide(
    16,
    "Quality Assurance",
    "16. Automated Testing & Verification Suite",
    "Rigorous verification ensuring 100% endpoint stability, security isolation, and data integrity.",
    [
        {
            "header": "Automated Test Coverage",
            "body": "• Security & RBAC Isolation (test-auth-isolation.js): Verifies protected routes reject unauthenticated requests.\n• Rate Limiting Tests (test-rate-limit.js): Verifies 429 response on brute-force attempts.\n• Data Integrity Tests (test-phase4.js & test-phase5.js): Verifies foreign key cascades and seed integrity."
        },
        {
            "header": "Live Production Verification (verify-live-deployment.js)",
            "body": "Executed directly against https://edupearl.onrender.com:\n✓ GET / (Homepage) — PASS\n✓ GET /api/health & /api/health/db — PASS\n✓ GET /api/branches (6 branches) — PASS\n✓ GET /api/services (6 offerings) — PASS\n✓ POST /api/enquiries (DB persistence) — PASS\n✓ POST /api/auth/login & GET /api/admin/me — PASS\n✓ Overall: 10 Passed, 0 Failed (100% Success)"
        }
    ],
    "15-admin-branches.png",
    "Figure 16.1: Branch Management Portal Showing Verified 6 Active Regional Centers",
    """
In Slide 16, I present our Automated Testing and Quality Assurance results.
To ensure the system is enterprise-ready, I built automated test scripts covering every layer:

First, we tested security isolation: verifying that unauthenticated visitors cannot access admin APIs.
Second, we verified rate limiting by simulating automated brute-force attacks.
Third, we ran automated end-to-end tests against our live deployed production website on Render.

As shown in our verification logs, all 10 production test suites passed with zero failures. This includes live public homepage loading, database health checks, inquiry submission and persistence, and super admin login over secure HTTPS.
"""
)

# ============================================================================
# SLIDE 17: Limitations & Future Scope
# ============================================================================
create_two_column_slide(
    17,
    "Project Evaluation",
    "17. System Limitations & Future Enhancements",
    "Academic assessment of current scope and strategic roadmap for enterprise scaling.",
    [
        {
            "header": "Current System Scope & Limitations",
            "body": "• Single-Instance In-Memory Rate Limiting: Rate limit counters reside in Node.js process memory; a multi-node cluster would benefit from Redis.\n• Manual Counselor Assignment: Lead allocation currently requires administrative assignment rather than algorithmic round-robin routing.\n• Single Language Interface: Public website is currently in English only."
        },
        {
            "header": "Strategic Future Scope & Enhancements",
            "body": "• Automated Messaging: Integrate Meta WhatsApp Cloud API and Twilio SMS for instant candidate confirmation messages.\n• Student Document Portal: Allow students to securely upload passport scans, IELTS scorecards, and transcripts for online counselor verification.\n• AI-Powered Eligibility Evaluator: Pre-screen candidate GPA and language band scores against university admission criteria using AI."
        }
    ],
    "17-mobile-responsive-view.png",
    "Figure 17.1: Mobile Responsive View (390x844) Demonstrating Multi-Device Adaptability",
    """
Slide 17 provides an honest academic evaluation of project limitations and future expansion.
Every software engineering project has boundaries:

Currently, our rate-limiting counters are maintained in-memory within Express. For horizontal scaling across multiple server instances, integrating Redis as a shared memory store would be the next step.
Second, counselor lead assignment is handled manually through the dashboard.

For future enhancements, three major features are planned:
First, automated WhatsApp and SMS notifications using Meta's Cloud API so students receive instant confirmation messages.
Second, a self-service Student Document Portal where candidates can upload passport and academic transcripts securely.
Third, an AI eligibility checker that compares candidate scores against university criteria in real time.
"""
)

# ============================================================================
# SLIDE 18: Conclusion & Thank You
# ============================================================================
slide18 = prs.slides.add_slide(blank_layout)

# Background Accent Card
bg_shape18 = slide18.shapes.add_shape(
    MSO_SHAPE.RECTANGLE,
    Inches(0.6), Inches(0.6), Inches(12.133), Inches(6.3)
)
bg_shape18.fill.solid()
bg_shape18.fill.fore_color.rgb = WHITE
bg_shape18.line.color.rgb = BORDER_GRAY
bg_shape18.line.width = Pt(1.5)

# Top Color Bar
top_bar18 = slide18.shapes.add_shape(
    MSO_SHAPE.RECTANGLE,
    Inches(0.6), Inches(0.6), Inches(12.133), Inches(0.18)
)
top_bar18.fill.solid()
top_bar18.fill.fore_color.rgb = BLUE_ACCENT
top_bar18.line.fill.background()

# Title
t18 = slide18.shapes.add_textbox(Inches(1.2), Inches(1.2), Inches(11), Inches(0.8))
pt18 = t18.text_frame.paragraphs[0]
pt18.text = "18. Conclusion & Viva Defense Summary"
pt18.font.size = Pt(24)
pt18.font.bold = True
pt18.font.color.rgb = NAVY_HEADER

# Subtitle
st18 = slide18.shapes.add_textbox(Inches(1.2), Inches(1.85), Inches(11), Inches(0.5))
pst18 = st18.text_frame.paragraphs[0]
pst18.text = "Successfully engineered, thoroughly tested, and live in cloud production."
pst18.font.size = Pt(12)
pst18.font.color.rgb = SLATE_MUTED

# 3 Summary Cards
card_w = Inches(3.6)
card_h = Inches(3.2)
card_y = Inches(2.6)

# Card 1: Technical Accomplishments
c1 = slide18.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.2), card_y, card_w, card_h)
c1.fill.solid()
c1.fill.fore_color.rgb = BG_CARD
c1.line.color.rgb = BORDER_GRAY
tf1 = c1.text_frame
tf1.word_wrap = True
p = tf1.paragraphs[0]
p.text = "FULL-STACK INTEGRATION"
p.font.size = Pt(11)
p.font.bold = True
p.font.color.rgb = CRIMSON
p_sub = tf1.add_paragraph()
p_sub.text = "• Responsive public portal with zero CSS framework bloat\n• Node.js & Express 5 REST API with clean middleware pipeline\n• 4 relational MySQL tables with foreign key integrity\n• Bcrypt & JWT security enforcement"
p_sub.font.size = Pt(10)
p_sub.font.color.rgb = SLATE_BODY
p_sub.space_before = Pt(6)

# Card 2: Production Deployment
c2 = slide18.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(5.1), card_y, card_w, card_h)
c2.fill.solid()
c2.fill.fore_color.rgb = BG_CARD
c2.line.color.rgb = BORDER_GRAY
tf2 = c2.text_frame
tf2.word_wrap = True
p2 = tf2.paragraphs[0]
p2.text = "PRODUCTION DEPLOYMENT"
p2.font.size = Pt(11)
p2.font.bold = True
p2.font.color.rgb = BLUE_ACCENT
p2_sub = tf2.add_paragraph()
p2_sub.text = "• Live Web Service: https://edupearl.onrender.com\n• Persistent Cloud DB: TiDB Cloud Serverless\n• Automated migration & seeding on every deploy\n• 10/10 Live test suites passed with 0 failures"
p2_sub.font.size = Pt(10)
p2_sub.font.color.rgb = SLATE_BODY
p2_sub.space_before = Pt(6)

# Card 3: Viva & Academic Value
c3 = slide18.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(9.0), card_y, card_w, card_h)
c3.fill.solid()
c3.fill.fore_color.rgb = BG_CARD
c3.line.color.rgb = BORDER_GRAY
tf3 = c3.text_frame
tf3.word_wrap = True
p3 = tf3.paragraphs[0]
p3.text = "ACADEMIC VALUE"
p3.font.size = Pt(11)
p3.font.bold = True
p3.font.color.rgb = GOLD_AMBER
p3_sub = tf3.add_paragraph()
p3_sub.text = "• Comprehensive source code PDF documentation prepared\n• Real-world software engineering lifecycle demonstrated\n• Secure engineering standards rigorously observed\n• Ready for live viva demonstration"
p3_sub.font.size = Pt(10)
p3_sub.font.color.rgb = SLATE_BODY
p3_sub.space_before = Pt(6)

# Bottom Thank You & Question Box
thank_box = slide18.shapes.add_textbox(Inches(1.2), Inches(6.0), Inches(10.9), Inches(0.7))
tf_th = thank_box.text_frame
p_th = tf_th.paragraphs[0]
p_th.text = "Thank You! • I am now ready for questions and live system demonstration."
p_th.font.size = Pt(14)
p_th.font.bold = True
p_th.font.color.rgb = NAVY_HEADER
p_th.alignment = PP_ALIGN.CENTER

set_speaker_notes(slide18, """
In conclusion, the Edupearl Web Development and Management System successfully bridges the gap between prospective international students and institutional counselors.

By engineering a full-stack architecture with Node.js, Express, and MySQL, we achieved high responsiveness, centralized inquiry persistence across six regional branches, and enterprise-grade security with JWT authentication.

The project is fully live and verified at https://edupearl.onrender.com with zero test failures.

I would like to express my sincere gratitude to my project supervisor, faculty members, and examiners for their guidance throughout this field project. I am now open to your questions and eager to demonstrate any feature live on the running application. Thank you.
""")

add_footer(slide18, 18)

# ----------------------------------------------------------------------------
# Save Presentation
# ----------------------------------------------------------------------------
prs.save(OUTPUT_PPTX)
print(f"[OK] PowerPoint Presentation generated successfully: {OUTPUT_PPTX}")
print(f"Total Slides: {len(prs.slides)}")
print(f"File Size: {(os.path.getsize(OUTPUT_PPTX) / 1024):.1f} KB")
