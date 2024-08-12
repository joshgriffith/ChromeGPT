let placeholders = [];
let chunks = [];
let wrapperClass = 'wrapper-span';
let template = '<article id="{{index}}">{{item}}</article>';

class AsyncQueue {
    constructor(worker, concurrency = 3) {
        this.worker = worker;
        this.concurrency = concurrency;
        this.queue = [];
        this.activeCount = 0;
    }

    enqueue(task) {
        this.queue.push(task);
        this.processQueue();
    }

    async processQueue() {
        if (this.activeCount < this.concurrency && this.queue.length) {
            this.activeCount++;
            const task = this.queue.shift();

            try {
                await this.worker(task);
            } catch (error) {
                console.error('Error processing task:', error);
            }

            this.activeCount--;
            this.processQueue();
        }
    }
}

function templatize(item, index) {
    return template.replaceAll('{{item}}', item).replaceAll('{{index}}', index);
}

function containsLetters(value) {
    return /\p{L}/u.test(value);
}

function replaceTextNodes(node) {

    if(node.tagName) {
        const tagName = node.tagName.toLowerCase();

        if (tagName === 'script' || tagName === 'style' || tagName === 'noscript') {
            return;
        }
    }

    if (node.nodeType === 3 && node.nodeValue.trim() !== '') {
        let value = node.nodeValue.trim();

        if(!value || value.startsWith('https://') || value.startsWith('http://') || !containsLetters(value)) {
            return;
        }

        // Todo: Use parent if only child

        const span = document.createElement('span');
        span.textContent = node.nodeValue;
        span.classList.add(wrapperClass);
        node.parentNode.replaceChild(span, node);
        placeholders.push(span);
    } else {
        node.childNodes.forEach(child => replaceTextNodes(child));
    }
}

chrome.storage.sync.get({ apikey: '', prompt: 'translate to English', model: 'gpt-4-turbo', workers: 3, chunkLength: 500, temperature: 0.2, endpoint: 'https://api.openai.com/v1/chat/completions' }, async (options) => {
    
    if(!options.apikey) {
        alert('You must set the API Key.');
        return;
    }

    if(!options.prompt) {
        alert('You must set the prompt.');
        return;
    }

    options.workers = options.workers || 3;
    options.chunkLength = options.chunkLength || 500;
    options.model = options.model || 'gpt-4-turbo';
    options.temperature = options.temperature || 0.2;
    options.endpoint = options.endpoint || 'https://api.openai.com/v1/chat/completions';

    function getChunk(node) {
        let contentLength = 0;
        let currentNode = node;
        let previousNode = null;
    
        while (!previousNode || (currentNode && currentNode.textContent.length <= options.chunkLength)) {
            previousNode = currentNode;
            currentNode = currentNode.parentNode;
        }
    
        return previousNode;
    }

    let selection = window.getSelection();

    if(selection && selection.type !== 'None' && selection.type !== 'Caret') {
        var range = selection.getRangeAt(0);
        replaceTextNodes(range.commonAncestorContainer);
    }
    else {
        replaceTextNodes(document.body);
    }

    while(placeholders.length) {
        let chunk = getChunk(placeholders[0]);

        if(!chunk) {
            break;
        }

        chunks.push(chunk);

        if(chunk == placeholders[0]) {
            placeholders.splice(0, 1);
            continue;
        }

        let childNodes = chunk.querySelectorAll('.' + wrapperClass);

        childNodes.forEach(each => {
            const index = placeholders.indexOf(each);
            placeholders.splice(index, 1);
        });
    }

    let groups = [];
    let currentGroup = [];
    let currentGroupSize = 0;

    chunks.forEach(chunk => {
        if(currentGroupSize + chunk.textContent.length >= options.chunkLength) {
            groups.push(currentGroup);
            currentGroup = [chunk];
            currentGroupSize = chunk.textContent.length;
            return;
        }

        currentGroupSize += chunk.textContent.length;
        currentGroup.push(chunk);
    });

    if(currentGroup.length) {
        groups.push(currentGroup);
    }

    async function openaiRequest(prompt) {
        let response = await fetch(options.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + options.apikey
            },
            body: JSON.stringify({
                model: options.model,
                messages: [
                    {
                        "role": "system",
                        "content": [
                            {
                                "type": "text",
                                "text": `Transform each article according to the provided instructions.`
                            }
                        ]
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": `# Instructions

Translate to English

## Articles

${templatize(`それぞれ、長さ約127㎝（50インチ）、幅約37㎝（14.5インチ）です。
重さは各45g（計90g）ぐらいです。`, 1)}
${templatize(`古布にしては状態が良い方ですが、以下のような細かな傷汚れが多々あります。
・両端に沿った縫い跡の、線状の黒ずみと針穴
・糸が引っ張られたことによる細い傷（糸ツレ）2か所
・緑色の花周辺の、経年による軽微な黄変（アク）
・黄色い花にある、針穴ほどの大きさの複数の小さな黒点
・下端のしみ`, 2)}
${templatize(`ご要望のない限り、折り畳んで発送します。`, 3)}`
                            }
                        ]
                    },
                    {
                        "role": "assistant",
                        "content": [
                            {
                                "type": "text",
                                "text": `${templatize(`Each panel measures approx. 127 cm (50 inches) in length, and approx. 37 cm (14.5 inches) in width.
The weight is about 45 g each (90 g in total).`, 1)}
${templatize(`The fabric is in relatively good vintage condition, with many small blemishes including:
- Old seams' dark lines and needle holes along the side edges
- Two thin flaws due to pulled thread
- Minor yellowing from age around the green flower
- Tiny, pin-sized black spots on the yellow flower - Stained bottom edges`, 2)}
${templatize(`The fabric will be sent folded unless otherwise requested.`, 3)}`
                            }
                        ]
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": `# Instructions

${options.prompt} 

## Articles

${prompt}`
                            }
                        ]
                    }
                ],
                temperature: parseFloat(options.temperature),
                max_tokens: 2000
            })
        });
    
        let json = await response.json();
        return json.choices[0].message.content;
    }

    function getChildNodes(group) {
        let children = [];

        group.forEach(chunk => {
            chunk.querySelectorAll('.' + wrapperClass).forEach(node => {
                children.push(node);
            });
        });

        return children;
    }

    function getLeadingWhitespace(value) {
        const match = value.match(/^\s+/);
        return match ? match[0] : '';
    }

    function getTrailingWhitespace(value) {
        const match = value.match(/\s+$/);
        return match ? match[0] : '';
    }

    let completed = 0;
    let startTime = Date.now();

    async function processGroup(group) {

        try {
            console.log('Submitting ' + groups.indexOf(group) + ' / ' + groups.length);
    
            let prompt = '';
            let chunks = getChildNodes(group);
    
            chunks.forEach(child => {
                prompt += templatize(child.textContent.trim(), chunks.indexOf(child) + 1) + '\n';
            });

            prompt = prompt.trim();
    
            let result = await openaiRequest(prompt);

            const regex = /<article\b[^>]*>([\s\S]*?)<\/article>/gi;
            let matches;
            let segments = [];

            while ((matches = regex.exec(result)) !== null) {
                segments.push(matches[1]);
            }

            if(segments.length !== chunks.length) {
                console.error(segments.length + ' vs ' + chunks.length, { input: prompt, output: result });
            }
    
            for(let segment = 0; segment < segments.length; segment++) {
                let content = segments[segment].trim();
    
                if(!content) {
                    continue;
                }
    
                let leading = getLeadingWhitespace(chunks[segment].textContent);
                let trailing = getTrailingWhitespace(chunks[segment].textContent);
    
                if(leading.length == 0) {
                    leading = ' ';
                }
    
                if(trailing.length == 0) {
                    trailing = ' ';
                }

                if(chunks.length < segment) {
                    chunks[chunks.length-1].textContent += (leading + content + trailing);
                }
                else {
                    chunks[segment].textContent = (leading + content + trailing);
                }
            }
        }
        finally {
            completed++;
            
            console.log('Completed ' + completed + ' / ' + groups.length);

            if(completed == groups.length) {
                console.log('Finished in ' + ((Date.now() - startTime) / 1000) + ' seconds')
            }
        }
    }

    let queue = new AsyncQueue(processGroup, options.workers);

    for(let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
        let group = groups[groupIndex];
        queue.enqueue(group);
    }

    //c.node.parentElement.style.cssText += '-webkit-filter: blur(3px); filter: blur(3px);';
    //chunk[choice.index].node.parentElement.style.cssText = chunk[choice.index].originalStyle;
});