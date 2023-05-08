let minLength = 8;
let maxBatchSize = 20;

function isVisible(elem) {
    if (!(elem instanceof Element)) throw Error('DomUtil: elem is not an element.');
    const style = getComputedStyle(elem);
    if (style.display === 'none') return false;
    if (style.visibility !== 'visible') return false;
    if (style.opacity < 0.1) return false;

    if (elem.offsetWidth + elem.offsetHeight + elem.getBoundingClientRect().height +
        elem.getBoundingClientRect().width === 0) {
        return false;
    }

    return true;
}

function shouldInclude(node, content) {

    // Skip below minimum length
    if(content.length <= minLength) {
        return false;
    }

    // Skip single words
    if(content.indexOf(' ') < 0) {
        return false;
    }

    // Skip script / style elements
    if(node.parentNode.localName === 'style' || node.parentNode.localName === 'script') {
        return false;
    }

    // Skip hidden elements
    if(node.offsetParent === null || !isVisible(node.parentNode)) {
        return false;
    }

    var style = window.getComputedStyle(node.parentNode, null).getPropertyValue('font-size');
    var fontSize = parseFloat(style);

    // Skip small fonts
    // Todo: Analyze average font size
    if(fontSize < 10) {
        return false;
    }

    return true;
}

function textNodesUnder(el){
    let node, results = [], walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);

    while(node = walk.nextNode()) {
        let content = node.textContent.trim();

        if(shouldInclude(node, content)) {
            results.push({ node: node, text: content });
        }
    }

    return results;
}

let nodes = [];
let selection = window.getSelection();

if(selection && selection.type !== 'None') {

    var range = selection.getRangeAt(0);
    var allWithinRangeParent = textNodesUnder(range.commonAncestorContainer);

    for (var i=0, el; el = allWithinRangeParent[i]; i++) {
        let node = el.node;

        if (selection.containsNode(node, true)) {

            let content = node.textContent.trim();

            if(shouldInclude(node, content)) {
                nodes.push({ node: node, text: content });
            }
        }
    }
}
else {
    nodes = textNodesUnder(document);
}

chrome.storage.sync.get({ apikey: '', prompt: '' }, async (options) => {
    
    if(!options.apikey) {
        alert('You must set the API Key.');
        return;
    }

    if(!options.prompt) {
        alert('You must set the prompt.');
        return;
    }

    let prompts = [];

    nodes.forEach(each => {
        prompts.push({
            prompt: "Rephrase the following statement as if it was " + options.prompt + " (the new text should be the same length as the original text):\n" + each.text + '\n',
            node: each.node
        });
    });

    prompts = prompts.slice(0, 100);

    for (let i = 0; i < prompts.length; i += maxBatchSize) {
        const chunk = prompts.slice(i, i + maxBatchSize);
        
        let response = await fetch('https://api.openai.com/v1/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + options.apikey
            },
            body: JSON.stringify({
                prompt: chunk.map(x => x.prompt),
                max_tokens: 300,
                temperature: 0.5,
                model: 'text-davinci-003'
            })
        });

        let json = await response.json();

        json.choices.forEach(choice => {
            console.log({
                old: chunk[choice.index].node.textContent,
                new: choice.text
            });

            chunk[choice.index].node.textContent = choice.text;
        });
    }
});