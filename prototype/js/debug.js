// Debug helper to log AppState
window.debugAppState = function() {
    console.log('Current AppState:', {
        currentUser: window.AppState.currentUser,
        contacts: window.AppState.contacts,
        activeContactId: window.AppState.activeContactId
    });
};

// Debug helper to log a specific contact
window.debugContact = function(contactId) {
    const contact = window.AppState.getContact(contactId);
    console.log('Contact details:', contact);
    return contact;
};

// Debug helper to log all messages for a contact
window.debugMessages = function(contactId) {
    const contact = window.AppState.getContact(contactId);
    if (!contact) {
        console.log('Contact not found:', contactId);
        return [];
    }
    console.log('Messages for contact:', contact.name, contact.messages);
    return contact.messages;
}; 