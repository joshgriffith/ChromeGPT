let minLength = 9;
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
        let content = node.textContent.trim() + ' ';

        if(shouldInclude(node, content)) {
            results.push({ node: node, text: content });
        }
    }

    return results;
}

let nodes = [];
let selection = window.getSelection();

console.log(selection)

if(selection && selection.type !== 'None' && selection.type !== 'Caret') {

    var range = selection.getRangeAt(0);
    var allWithinRangeParent = textNodesUnder(range.commonAncestorContainer);

    for (var i=0, el; el = allWithinRangeParent[i]; i++) {
        let node = el.node;

        if (selection.containsNode(node, true)) {

            let content = node.textContent.trim() + ' ';

            if(shouldInclude(node, content)) {
                nodes.push({ node: node, text: content });
            }
        }
    }

    if(!allWithinRangeParent.length) {
        let node = selection.baseNode;
        let content = node.textContent.trim() + ' ';

        if(shouldInclude(node, content)) {
            nodes.push({ node: node, text: content });
        }
    }
}
else {
    nodes = textNodesUnder(document);

    console.log('nodes', nodes);
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
            prompt: "Rephrase the following (using the same length of text) as if it was " + options.prompt + " (keep it short, do not exceed length):\n" + each.text + '\n',
            node: each.node
        });
    });

    // Maximum of 100 results
    prompts = prompts.slice(0, 100);

    for (let i = 0; i < prompts.length; i += maxBatchSize) {
        const chunk = prompts.slice(i, i + maxBatchSize);
        let prompt = chunk.map(x => x.prompt);

        chunk.forEach(c => {
            if(c.node.parentElement && c.node.parentElement.style) {
                if(!c.node.parentElement.style.cssText) {
                    c.node.parentElement.style.cssText = '';
                }

                c.originalStyle = c.node.parentElement.style.cssText;
                c.node.parentElement.style.cssText += '-webkit-filter: blur(3px);filter: blur(3px);';
            }
        });

        let response = await fetch('https://api.openai.com/v1/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + options.apikey
            },
            body: JSON.stringify({
                prompt: prompt,
                max_tokens: 200,
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

            chunk[choice.index].node.textContent = choice.text.replaceAll('\n', '');
            chunk[choice.index].node.parentElement.style.cssText = chunk[choice.index].originalStyle;
        });
    }
});