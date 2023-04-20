const API_KEY = "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";
const submitButton = document.querySelector('#submit');
const outputElement = document.querySelector('#output');
const inputElement = document.querySelector('.inputText');
const histroyElement = document.querySelector('.history');
const buttonElement = document.querySelector('.newChatBtn');

function changeInput(value) {
    const inputElement = document.querySelector('.inputText')
    inputElement.value = value
}

async function getMessage() {
    console.log('Clicked');
    const options = {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ${API_KEY}',
            'Content-type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{ role: "user", content: inputElement.value }],
            max_tokens: 1000
        })
    }
    try {
        await fetch('https://api.openai.com/v1/chat/completions', options);
        const data = await responce.json();
        console.log(data);
        outputElement.textContent = data.choices[0].message.content;
        if (data.choices[0].message.content) {
            const pElement = document.createElement('p');
            pElement.textConent = inputElement.value;
            pElement.addEventListener('click', () => changeInput(pElement.textContent))
            historyElement.append(pEmelent);
        }
    }
    catch (error){
        console.error(error);
    }
}

function clearInput()   {
    inputElement.value = "";
}

submitButton.addEventListener('click', getMessage);
buttonElement.addEventListener('click', clearInput);