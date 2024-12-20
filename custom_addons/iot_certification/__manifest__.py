{
    'name': 'IoT Certification',
    'version': '1.0',
    'author': 'Nadiia Melnyk',
    'depends': [
        'base',
        'product',
        'mail',
        'sale_management'
    ],
    'data': [
        # iot security related
        'security/res_groups.xml',
        'security/ir_rules.xml',
        'security/ir.model.access.csv',
        #view
        'views/iot_certification_products.xml',
        'views/iot_certification_partner.xml',
        'views/iot_certification_dstu.xml',
        'views/iot_certification_report_for-view.xml',
        'views/iot_certification_sw_hw.xml',
        'views/iot_certification_assessment.xml',
        'views/iot_certification_order_view.xml',
        'views/iot_certification_menu.xml',
        'views/iot_certification_testing_laboratory.xml',
        'views/iot_certification_additional_order_view.xml',
        'views/iot_certification_enterprise.xml',
        # iot application report related
        'reports/iot_application_report/iot_application_report_style.xml',
        'reports/iot_application_report/iot_application_report_header_style.xml',
        'reports/iot_application_report/iot_application_report_header_html_document.xml',
        'reports/iot_application_report/iot_application_report_html_document.xml',
        'reports/iot_application_report/iot_application_report.xml',
        # iot report related
        'reports/iot_certification_report/iot_certification_report.xml',
        'reports/iot_certification_report/iot_certification_report_protocol.xml',
        'reports/iot_certification_report/iot_certification_report_plan.xml',
        'reports/iot_certification_report/iot_certification_report_form.xml',
        'reports/iot_certification_report/iot_certification_report_analysis_and_notes.xml',
        'reports/iot_certification_report/iot_certification_report_styles.xml',
        # iot certification report related
        "reports/iot_certification_certification_report/iot_certification_certification_report_style.xml",
        "reports/iot_certification_certification_report/iot_certification_certification_report_page_1_html_document.xml",
        "reports/iot_certification_certification_report/iot_certification_certification_report_appendix_1_html.xml",
        "reports/iot_certification_certification_report/iot_certification_certification_report_appendix_2_html.xml",
        "reports/iot_certification_certification_report/iot_certification_certification_technical_specification_html.xml",
        "reports/iot_certification_certification_report/iot_certification_certification_report.xml",
    ],
    'assets': {
        'web.assets_backend': [
            'owl_playground/static/lib/eusign.js',
            'iot_certification/static/src/sign_component/*',
            'iot_certification/static/src/check_sign_component/*',
        ],
    },
    'installable': True,
    'auto_install': True,
}
