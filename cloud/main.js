const { Client } = require('wolf.js');
const fruits = ["تفاح", "توت العليق الأوروبي", "عنب", "ليمون", "بابايا", "موز", "كيوي", "طماطم", "خيار", "باذنجان", "مشمش", "دراق", "خوخ", "مانجو", "كرز", "فول", "حمص", "بازيلاء", "فاصولياء", "جوز", "لوز", "بندق", "فراولة", "توت بري", "توت عليق", "قشطة", "أناناس", "تين", "توت شامي", "فاكهة الخبز", "جوز الهند", "برتقال", "جريب فروت", "رمان", "زيتون", "سفرجل", "عنب أوروبي", "كاكا", "أجاص", "أكي دنيا", "برقوق", "إجاص", "بكان", "فستق", "كاشو", "توت", "بلح", "تمر", "نارنج", "كمثرى", "نكترين", "أفوكادو", "يوسفي", "بطيخ", "شمام", "ليمون حمضي", "آس بري", "افوكادو", "أكي", "تمر هندي", "فاكهة التنين", "تين شوكي", "جوافة", "زعرور", "صبار", "حبوب الصنوبر", "عليق", "عناب", "عنبية", "قرع", "كاجو", "كاكاو", "كاكي", "كريفون", "كشمش أسود", "كمكوات", "كوسة", "لوز استوائي", "لونجان", "ليتشي", "نبق", "حمضيات", "جوز كالانرى", "ديكوبون", "باشون فروت", "كمثرى وليامز", "توماتيلو", "بيرى", "دوريان", "سفرجل هندى", "كريز المارشينو", "زبيب", "ليم", "عنب الثعلب", "جوجى", "لانزونز", "يد بوذا", "لوكوما", "نجمة التفاح", "بالميرا", "مانجوستين", "جاك فروت", "بلو بيري", "كارامبولا", "فاكهة النجمة", "توت العليق", "بلوط", "بوملي", "رامبوتان", "بطيخ أحمر", "مندلينا"];

const client = new Client();
let games = {};
let globalPoints = {};
let groupPoints = {};

async function sendReminder(groupId, message, delay, game) {
    return setTimeout(async () => {
        if (games[groupId]?.id === game.id) {
            await client.messaging.sendGroupMessage(groupId, message);
        }
    }, delay);
}

class Game {
    constructor(groupId, creatorId, creatorAlias) {
        this.id = Date.now();
        this.groupId = groupId;
        this.creatorId = creatorId;
        this.players = [{ subscriberId: creatorId, alias: creatorAlias }];
        this.stage = 'waiting';
        this.timers = [];
        this.fruit = '';
        this.spy = null;
        this.votes = {};
        this.started = false;

        this.startWaitingTimer();
    }

    startWaitingTimer() {
        this.timers.push(setTimeout(async () => {
            if (this.stage === 'waiting') {
                await client.messaging.sendGroupMessage(this.groupId, 'تم إلغاء اللعبة بسبب عدم اكتمال العدد');
                delete games[this.groupId];
            }
        }, 180000));

        this.timers.push(sendReminder(this.groupId, '/alert باقي دقيقتان على اغلاق اللعبه', 60000, this));
        this.timers.push(sendReminder(this.groupId, '/alert باقي دقيقه على اغلاق اللعبه', 120000, this));
    }

    startGame() {
        this.stage = 'voting';
        this.fruit = fruits[Math.floor(Math.random() * fruits.length)];
        this.spy = this.players[Math.floor(Math.random() * this.players.length)].subscriberId;

        this.players.forEach(player => {
            const message = player.subscriberId === this.spy 
                ? 'أنت الجاسوس! الفاكهة هي إحدى الفواكه في القائمة.' 
                : `الفاكهة هي: ${this.fruit}`;
            client.messaging.sendPrivateMessage(player.subscriberId, message);
        });

        this.startVotingTimer();
    }

    startVotingTimer() {
        this.timers.push(setTimeout(async () => {
            if (this.stage === 'voting') {
                await this.endVoting();
            }
        }, 180000));

        this.timers.push(sendReminder(this.groupId, '/alert باقي دقيقتان على انتهاء الوقت', 60000, this));
        this.timers.push(sendReminder(this.groupId, '/alert باقي دقيقه على انتهاء الوقت', 120000, this));
    }

    async endVoting() {
        this.stage = 'ended';
        this.timers.forEach(timer => clearTimeout(timer));

        // معالجة التصويت
        this.players.forEach(player => {
            if (this.votes[player.subscriberId] === undefined) {
                this.adjustPoints(player.subscriberId, -1);
                this.adjustPoints(this.spy, 1);
            }
        });

        // عرض النتائج
        let resultMessage = '/me النتائج:\n';
        this.players.forEach(player => {
            const role = player.subscriberId === this.spy ? 'جاسوس' : this.fruit;
            resultMessage += `${player.alias}: ${role}\n`;
        });
        await client.messaging.sendGroupMessage(this.groupId, resultMessage);

        // عرض التغييرات في النقاط
        let pointsMessage = '/me التغييرات:\n';
        this.players.forEach(player => {
            pointsMessage += `${player.alias}: ${globalPoints[player.subscriberId] || 0} نقطة\n`;
        });
        await client.messaging.sendGroupMessage(this.groupId, pointsMessage);

        delete games[this.groupId];
    }

    adjustPoints(subscriberId, delta) {
        globalPoints[subscriberId] = (globalPoints[subscriberId] || 0) + delta;
        groupPoints[this.groupId] = groupPoints[this.groupId] || {};
        groupPoints[this.groupId][subscriberId] = (groupPoints[this.groupId][subscriberId] || 0) + delta;
    }

    addPlayer(subscriberId, alias) {
        if (!this.players.some(p => p.subscriberId === subscriberId)) {
            this.players.push({ subscriberId, alias });
            return true;
        }
        return false;
    }

    removePlayer(subscriberId) {
        const index = this.players.findIndex(p => p.subscriberId === subscriberId);
        if (index !== -1) {
            this.players.splice(index, 1);
            return true;
        }
        return false;
    }

    vote(playerId, voteIndex) {
        if (voteIndex >= 1 && voteIndex <= this.players.length) {
            const votedPlayer = this.players[voteIndex - 1];
            
            if (votedPlayer.subscriberId === this.spy) {
                this.adjustPoints(playerId, 1);
                this.adjustPoints(this.spy, -1);
            } else {
                this.adjustPoints(playerId, -1);
                this.adjustPoints(this.spy, 1);
            }
            
            this.votes[playerId] = voteIndex;
            return true;
        }
        return false;
    }
}

client.on('message', async (message) => {
    if (!message.content) return;

    const command = message.content.trim();
    const groupId = message.targetGroupId;
    const subscriberId = message.sourceSubscriberId;
    const alias = message.sourceSubscriberNickname;

    // الأوامر العامة
    if (command === '!جس مساعده' || command === '!جاسوس مساعده') {
        const helpText = `/me
*(!جس انشاء) او (!جاسوس انشاء) لانشاء اللعبه
*(!جس انظم) او (!جاسوس انظم) للانظمام للعبه
*(!جس بدء) او (!جاسوس بدء) لبدء اللعبه
*(!جس ترتيب) او (!جاسوس ترتيب) لعرض النقاط والترتيب على مستوى القناه
*(!جس مجموع) او (!جاسوس مجموع) لعرض مجموع النقاط والترتيب على مستوى التطبيق
*(!جس طرد رقم_العضوية) او (!جاسوس طرد رقم_العضوية) لطرد لاعب من قبل منشئ اللعبه
*(!جس مساعده) او (!جاسوس مساعده) لعرض اوامر البوت`;
        await client.messaging.sendGroupMessage(groupId, helpText);
    }

    // إنشاء لعبة
    if (command === '!جس انشاء' || command === '!جاسوس انشاء') {
        if (games[groupId]) {
            await client.messaging.sendGroupMessage(groupId, 'هناك لعبة نشطة بالفعل!');
            return;
        }
        games[groupId] = new Game(groupId, subscriberId, alias);
        await client.messaging.sendGroupMessage(groupId, 'تم إنشاء لعبة الجاسوس! اكتب !جس انظم للانضمام');
    }

    // الانضمام للعبة
    if (command === '!جس انظم' || command === '!جاسوس انظم') {
        const game = games[groupId];
        if (!game) {
            await client.messaging.sendGroupMessage(groupId, 'لا توجد لعبة نشطة!');
            return;
        }
        if (game.addPlayer(subscriberId, alias)) {
            await client.messaging.sendGroupMessage(groupId, `تم انضمام ${alias} للعبة!`);
        } else {
            await client.messaging.sendGroupMessage(groupId, 'أنت منضم بالفعل!');
        }
    }

    // بدء اللعبة
    if (command === '!جس بدء' || command === '!جاسوس بدء') {
        const game = games[groupId];
        if (!game) {
            await client.messaging.sendGroupMessage(groupId, 'لا توجد لعبة نشطة!');
            return;
        }
        if (game.creatorId !== subscriberId) {
            await client.messaging.sendGroupMessage(groupId, 'فقط منشئ اللعبة يمكنه البدء!');
            return;
        }
        if (game.players.length < 3) {
            await client.messaging.sendGroupMessage(groupId, 'يجب أن يكون هناك 3 لاعبين على الأقل!');
            return;
        }
        game.startGame();
        
        let playersList = '/me قائمة اللاعبين:\n';
        game.players.forEach((player, index) => {
            playersList += `${index + 1}. ${player.alias} (${globalPoints[player.subscriberId] || 0} نقطة)\n`;
        });
        await client.messaging.sendGroupMessage(groupId, playersList);
    }

    // التصويت (رسالة خاصة)
    if (!message.isGroup) {
        const game = Object.values(games).find(g => 
            g.players.some(p => p.subscriberId === subscriberId) && g.stage === 'voting'
        );
        
        if (game && /^\d+$/.test(command)) {
            const voteIndex = parseInt(command);
            if (game.vote(subscriberId, voteIndex)) {
                await client.messaging.sendPrivateMessage(subscriberId, 'تم تسجيل تصويتك!');
            } else {
                await client.messaging.sendPrivateMessage(subscriberId, 'رقم غير صحيح!');
            }
        }
        return;
    }

    // إنهاء التصويت
    if (command === '!جس تم' || command === '!جاسوس تم') {
        const game = games[groupId];
        if (game && game.creatorId === subscriberId && game.stage === 'voting') {
            await game.endVoting();
        }
    }

    // طرد لاعب
    if (command.startsWith('!جس طرد') || command.startsWith('!جاسوس طرد')) {
        const parts = command.split(' ');
        const playerId = parseInt(parts[2]);
        const game = games[groupId];
        
        if (game && game.creatorId === subscriberId && game.stage === 'waiting' && playerId) {
            if (game.removePlayer(playerId)) {
                await client.messaging.sendGroupMessage(groupId, `تم طرد اللاعب ${playerId}`);
            }
        }
    }

    // ترتيب القناة
    if (command === '!جس ترتيب' || command === '!جاسوس ترتيب') {
        if (!groupPoints[groupId]) {
            await client.messaging.sendGroupMessage(groupId, 'لا توجد بيانات!');
            return;
        }
        
        const sorted = Object.entries(groupPoints[groupId])
            .sort((a, b) => b[1] - a[1])
            .map(async ([id, points], index) => {
                const user = await client.subscriber.getById(parseInt(id));
                return `${index + 1}. ${user.nickname}: ${points} نقطة`;
            });
        
        const result = await Promise.all(sorted);
        await client.messaging.sendGroupMessage(groupId, `/me ترتيب اللاعبين:\n${result.join('\n')}`);
    }

    // الترتيب العام
    if (command === '!جس مجموع' || command === '!جاسوس مجموع') {
        const globalArray = Object.entries(globalPoints)
            .sort((a, b) => b[1] - a[1]);
        
        const playerIndex = globalArray.findIndex(([id]) => parseInt(id) === subscriberId);
        const points = globalPoints[subscriberId] || 0;
        
        await client.messaging.sendPrivateMessage(
            subscriberId,
            playerIndex === -1 
                ? `نقاطك: ${points} (لم تصنف بعد)`
                : `ترتيبك: ${playerIndex + 1} - نقاطك: ${points}`
        );
    }
});

client.login('scodoublet@yahoo.com', '12345')
    .then(() => console.log('تم تسجيل الدخول!'))
    .catch(err => console.error('خطأ في تسجيل الدخول:', err));
