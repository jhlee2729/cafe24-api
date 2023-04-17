const Slack = require('slack-node');
const webhookUri = "https://hooks.slack.com/services/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";
const slack = new Slack();

slack.setWebhook(webhookUri);

const send = async(country, message, callback) => {

    slack.webhook({
        channel: "#error-jolse-order", // 전송될 슬랙 채널
        username: "jolse-api", //슬랙에 표시될 이름
        text: country + ' - ' + JSON.stringify(message)
    }, callback);
}

module.exports = send;