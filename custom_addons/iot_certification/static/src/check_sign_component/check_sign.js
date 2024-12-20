/** @odoo-module **/

import {registry} from '@web/core/registry';

const {Component} = owl;

export class OwlCheckSign extends Component {
    setup() {
        this.check_sign_widget_url =
            "https://test.id.gov.ua/verify-widget/v2022testnew/?address=http://sedo.qualitek.com.ua:8069"
    }
}

OwlCheckSign.template = 'iot_certification.OwlCheckSign'
registry.category('actions').add('iot_certification.action_check_sign_js', OwlCheckSign);
