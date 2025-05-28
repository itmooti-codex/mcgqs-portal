import Config from './config.js';
import ChartApp from './chartApp.js';
const { apiKey, apiEndpoint, visitorReferralSource } = Config;
export default class ContactsApp {
    async start() {
        // expose our ChartApp (so you could also call chartApp methods here if needed)
        window.chartApp = new ChartApp();
        window.consoleClicked = (contactId) => {
            chartApp.refererConditionUpdater(contactId);
        };

        await this.loadContacts();
    }


    async loadContacts() {
        const query = `
      query calcContacts {
        calcContacts(
          query: [
            {
              where: {
                Company: [
                  { where: { name: "${visitorReferralSource}" } }
                ]
              }
            }
          ]
         limit: 50000
          offset: 0
          ) {
          id: field(arg: ["id"])
          First_Name: field(arg: ["first_name"])
          Last_Name: field(arg: ["last_name"])
        }
      }
    `;


        const response = await fetch(apiEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Api-Key": apiKey
            },
            body: JSON.stringify({ query })
        });

        const { data } = await response.json();
        const contacts = data.calcContacts;
        if (!contacts || contacts.length === 0) {
            console.error('No contacts found');
            return;
        }
        function contactLinkTpl({ id, name }) {
            return `
    <a
      href="#"
      @click="
        document.getElementById('contactTypeDropdownContainer').textContent = '${name}';
        selectedContact = '${id}';
        openContactDropdown = false;
        consoleClicked('${id}');
      "
      :class="selectedContact === '${id}' 
        ? 'bg-blue-100 text-blue-800 font-semibold' 
        : ''"
      class="block px-4 py-2 hover:bg-gray-100"
    >
      ${name}
    </a>
  `;
        }
        const dropdownMenu = document.getElementById('contact-dropdown');
        contacts.forEach(contact => {
            const name = `${contact.First_Name} ${contact.Last_Name}`;
            const html = contactLinkTpl({ id: contact.id, name });
            dropdownMenu.insertAdjacentHTML('beforeend', html);
        });
    }
}
