// This function is useful for creating a tree structure of HTML elements.
// You can recursively nest calls to tag(...) within the list of children.
// Children can also be strings which will be automatically converted to
// text nodes in the tree.
// I really just thought this was a lot less effort than pulling out a whole
// single page app framework that I'm not as familiar with. Maybe one day
// JSX will be built into browsers.
const tag = function(tagName) {
    // Create the element with the specified tag name
    const element = document.createElement(tagName);

    for (let i = 1; i < arguments.length; i++) {
        let child = arguments[i];
        if (child instanceof Element || child instanceof Text) {
            element.appendChild(child);
        } else if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
        } else if (i === 1 && typeof child === 'object') {
            // The first argument after tag name might be
            // options rather than a child node.
            let opts = arguments[i];

            // Set attributes.
            for (const [attrName, attrValue] of Object.entries(opts.attrs || {})) {
                element.setAttribute(attrName, attrValue);
            }

            // Add event listeners.
            for (const [eventName, callback] of Object.entries(opts.eventListeners || {})) {
                element.addEventListener(eventName, callback);
            }
        } else {
            // May add more conditions or handle other types of children as needed.
            console.log(`arg is ${child}`)
            throw new Error('Children must be instance of Element, Text, or string')
        }
    }

    return element;
};


// Create many common element shortcut functions.
(function(){
    for (let tagName of [
        'h1', 'h2', 'h3', 'h4', 'h5',
        'div', 'span', 'p', 'ul', 'li',
        'b', 'strong', 'em', 'br', 'hr',
        'button', 'form', 'fieldset',
        'input', 'legend', 'label',
    ]) {
        tag[tagName] = function() {
            let args = [tagName];
            args.push.apply(args, arguments);
            return tag.apply(null, args);
        };
    }
})();
