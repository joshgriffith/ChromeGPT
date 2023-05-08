const saveOptions = () => {
    const apikey = document.getElementById('apikey').value;
    const prompt = document.getElementById('prompt').value;

    chrome.storage.sync.set({ apikey: apikey, prompt: prompt }, () => {
        const status = document.getElementById('status');
        status.textContent = 'Options saved.';
        
        setTimeout(() => {
            status.textContent = '';
        }, 1500);
    });
};

const restoreOptions = () => {
    chrome.storage.sync.get({ apikey: '', prompt: '' }, (items) => {
        document.getElementById('apikey').value = items.apikey;
        document.getElementById('prompt').value = items.prompt;
    });
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);