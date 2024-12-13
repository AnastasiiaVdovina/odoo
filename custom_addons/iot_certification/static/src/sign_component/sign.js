/** @odoo-module **/

import {registry} from '@web/core/registry';

const {Component, useState, onWillStart, useRef} = owl;
import {useService} from "@web/core/utils/hooks";

export class OwlSign extends Component {
    setup() {
        const SIGN_WIDGET_PARENT_ID = "sign-widget-parent";
        const SIGN_WIDGET_ID = "sign-widget";
        const SIGN_WIDGET_URI = "https://test.id.gov.ua/sign-widget/v2022testnew/";

        if (typeof EndUser === null) {
            console.error("eusign.js не завантажився. Перевірте підключення файлу.");
            return;
        } else {
            console.log("eusign.js завантажився.");
        }

        this.state = useState({
            attachmentList: [],
            key_read: false,
            sign_widget_parent: true,
            qr_code_block: true,
        })
        this.orm = useService("orm")
        this.ir_attachment_model = "ir.attachment"
        this.res_model = "iot_certification_order"
        this.searchInput = useRef("search-input")

        onWillStart(async () => {
            await this.getAllAttachments()
        })

        this.waitForParent(SIGN_WIDGET_PARENT_ID, () => {
            this.euSign = new EndUser(SIGN_WIDGET_PARENT_ID, SIGN_WIDGET_ID, SIGN_WIDGET_URI, EndUser.FormType.ReadPKey);
            this.initSignWidget();
        });
    }

    async getAllAttachments() {
        this.state.attachmentList = await this.orm.searchRead(
            this.ir_attachment_model,
            [['res_model', '=', this.res_model]],
            ["name", "datas"]
        )
    }

    async searchAttachments(){
        const text = this.searchInput.el.value
        this.state.attachmentList = await this.orm.searchRead(
            this.ir_attachment_model,
            [
                ['name', 'ilike', text],
                ['res_model', '=', this.res_model]
            ],
            ["name", "datas"]
        );
    }

    waitForParent(parentId, callback) {
        const observer = new MutationObserver(() => {
            const parentElement = document.getElementById(parentId);
            if (parentElement) {
                observer.disconnect();
                callback();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    initSignWidget() {
        this.euSign
            .ReadPrivateKey()
            .then(() => this.euSign.AddEventListener(EndUser.EventType.ConfirmKSPOperation, this.onConfirmKSPOperation.bind(this)))
            .then(() => {
                this.state.key_read = true;
                this.state.sign_widget_parent = false;
                this.state.qr_code_block = false;
            })
            .catch((e) => alert(`Помилка зчитування ключа: ${e.message}`));
    }

    onConfirmKSPOperation(event) {
        const qrCodeBlock = document.getElementById("qr-code-block");
        qrCodeBlock.innerHTML = `
            <a href="${event.url}">
                <img src="data:image/bmp;base64,${event.qrCode}" style="padding: 10px; background: white;" />
            </a>
        `;
        qrCodeBlock.style.display = "block";
    }

    onSign(attachment) {
        const { datas } = attachment;
        const decodedData = this.base64ToUint8Array(datas);


        this.euSign.PAdESSignData(decodedData, false, EndUser.SignAlgo.DSTU4145WithGOST34311, EndUser.PAdESSignLevel.PAdES_B_B)
            .then((signedPdf) => {
                this.state.qr_code_block = false;

                const blob = new Blob([signedPdf], { type: 'application/pdf' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = attachment.name + '.pdf';
                link.click();
            })
            .catch((e) => {
                this.state.qr_code_block = false;
                alert(`Помилка підпису: ${e.message}`);
            });
    }

    base64ToUint8Array(base64) {
        const binaryString = atob(base64);  // Декодує строку Base64 в бінарну строку
        const length = binaryString.length;
        const uint8Array = new Uint8Array(length);

        for (let i = 0; i < length; i++) {
            uint8Array[i] = binaryString.charCodeAt(i);
        }

        return uint8Array;
    }
}

OwlSign.template = 'iot_certification.OwlSign'
registry.category('actions').add('iot_certification.action_sign_js', OwlSign);
