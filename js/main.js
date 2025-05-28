import ChartApp from './chartApp.js';
import ContactsApp from './getContacts.js';
window.addEventListener('DOMContentLoaded', () => {
  const app = new ChartApp();
  const contactsApp = new ContactsApp();
  app.start();
  contactsApp.start();
});
