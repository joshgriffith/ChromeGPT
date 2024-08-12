const saveOptions = () => {
    const apikey = document.getElementById('apikey').value;
    const prompt = document.getElementById('prompt').value;
    const model = document.getElementById('model').value;
    const workers = document.getElementById('workers').value;
    const chunkLength = document.getElementById('chunkLength').value;
    const temperature = document.getElementById('temperature').value;
    const endpoint = document.getElementById('endpoint').value;

    chrome.storage.sync.set({ apikey: apikey, prompt: prompt, model: model, workers: workers, chunkLength: chunkLength, temperature: temperature, endpoint: endpoint }, () => {
        const status = document.getElementById('status');
        status.textContent = 'Options saved.';
        
        setTimeout(() => {
            status.textContent = '';
        }, 1500);
    });
};

const restoreOptions = () => {
    chrome.storage.sync.get({ apikey: '', prompt: 'translate to English', model: 'gpt-4-turbo', workers: 3, chunkLength: 500, temperature: 0.2, endpoint: 'https://api.openai.com/v1/chat/completions' }, (items) => {
        document.getElementById('apikey').value = items.apikey;
        document.getElementById('prompt').value = items.prompt;
        document.getElementById('model').value = items.model;
        document.getElementById('workers').value = items.workers;
        document.getElementById('chunkLength').value = items.chunkLength;
        document.getElementById('temperature').value = items.temperature;
        document.getElementById('endpoint').value = items.endpoint;
    });
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);