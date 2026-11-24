
const { Client, IntentsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes } = require('discord.js');

// تكوين البوت - ضع معلوماتك هنا
const config = {
  token: "توكن_بوتك",
  clientId: "ايدي_بوتك",
  mongoURL: "رابط_مونجو"
};

// إنشاء العميل
const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
});

// متغيرات البوت
let gamesPlayed = 0;

// تسجيل الأوامر
const commands = [
  { name: 'help', description: 'عرض جميع أوامر البوت والألعاب المتاحة' },
  { name: 'rps', description: 'لعبة حجرة ورقة مقص' },
  { name: 'quiz', description: 'لعبة المسابقات' },
  { name: 'xo', description: 'لعبة XO' },
  { name: 'roulette', description: 'لعبة الروليت' },
  { name: 'slots', description: 'ماكينات القمار' },
  { name: 'hangman', description: 'لعبة التخمين' },
  { name: 'bingo', description: 'لعبة البنغو' },
  { name: 'trivia', description: 'أسئلة ثقافية' },
  { name: 'blackjack', description: 'لعبة 21' },
  { name: 'lotto', description: 'اليانصيب' },
  { name: 'wheel', description: 'عجلة الحظ' },
  { name: 'dice', description: 'لعبة النرد' },
  { name: 'guess', description: 'تخمين الأرقام' },
  { name: 'wordle', description: 'لعبة الكلمات' },
  { name: 'typing', description: 'اختبار السرعة في الكتابة' },
  { name: 'math', description: 'مسائل رياضية' }
];

// تعريف جميع الألعاب
const gameDefinitions = {
  // لعبة الحجرة ورقة مقص
  rps: {
    choices: ['✊', '✋', '✌️'],
    results: {
      '✊✊': 'تعادل!',
      '✊✋': 'أنت تخسر! الورقة تغلف الحجرة',
      '✊✌️': 'أنت تفوز! الحجرة تكسر المقص',
      '✋✊': 'أنت تفوز! الورقة تغلف الحجرة',
      '✋✋': 'تعادل!',
      '✋✌️': 'أنت تخسر! المقص يقطع الورقة',
      '✌️✊': 'أنت تخسر! الحجرة تكسر المقص',
      '✌️✋': 'أنت تفوز! المقص يقطع الورقة',
      '✌️✌️': 'تعادل!'
    },
    execute: async (interaction) => {
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🎮 حجرة ورقة مقص (RPS)')
        .setDescription('اختر أحد الخيارات التالية:');

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder().setCustomId('rps_rock').setLabel('✊ حجرة').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('rps_paper').setLabel('✋ ورقة').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('rps_scissors').setLabel('✌️ مقص').setStyle(ButtonStyle.Primary)
        );

      await interaction.reply({ embeds: [embed], components: [row] });
    },
    handleInteraction: async (interaction) => {
      const userChoice = interaction.customId.split('_')[1];
      let userEmoji;
      
      if (userChoice === 'rock') userEmoji = '✊';
      else if (userChoice === 'paper') userEmoji = '✋';
      else if (userChoice === 'scissors') userEmoji = '✌️';
      
      const botChoice = gameDefinitions.rps.choices[Math.floor(Math.random() * gameDefinitions.rps.choices.length)];
      const resultKey = userEmoji + botChoice;
      const result = gameDefinitions.rps.results[resultKey];
      
      const resultEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🎮 نتيجة اللعبة')
        .setDescription(`اختيارك: ${userEmoji}\nاختيار البوت: ${botChoice}\n\n**${result}**`);
      
      await interaction.update({ embeds: [resultEmbed], components: [] });
    }
  },

  // لعبة المسابقات
  quiz: {
    questions: [
      {
        question: "ما هي عاصمة فرنسا؟",
        options: ["لندن", "برلين", "باريس", "مدريد"],
        answer: "باريس"
      },
      {
        question: "كم عدد الكواكب في النظام الشمسي؟",
        options: ["7", "8", "9", "10"],
        answer: "8"
      },
      {
        question: "ما هو أكبر محيط في العالم؟",
        options: ["المحيط الأطلسي", "المحيط الهندي", "المحيط الهادئ", "المحيط المتجمد الشمالي"],
        answer: "المحيط الهادئ"
      },
      {
        question: "من رسم لوحة الموناليزا؟",
        options: ["بيكاسو", "فان جوخ", "ليوناردو دا فينشي", "ميكيلانجيلو"],
        answer: "ليوناردو دا فينشي"
      }
    ],
    execute: async (interaction) => {
      const randomQuestion = gameDefinitions.quiz.questions[Math.floor(Math.random() * gameDefinitions.quiz.questions.length)];
      
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('❓ لعبة المسابقات')
        .setDescription(randomQuestion.question)
        .addFields({ name: 'الخيارات', value: randomQuestion.options.map((opt, i) => `${i+1}. ${opt}`).join('\n') })
        .setFooter({ text: 'لديك 15 ثانية للإجابة!' });

      await interaction.reply({ embeds: [embed] });
      
      const filter = response => {
        return randomQuestion.options.some(opt => opt === response.content) || 
               randomQuestion.options.some((opt, i) => (i+1).toString() === response.content);
      };

      try {
        const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 15000, errors: ['time'] });
        const answer = collected.first();
        let userAnswer = answer.content;
        
        if (!isNaN(userAnswer)) {
          const index = parseInt(userAnswer) - 1;
          if (index >= 0 && index < randomQuestion.options.length) {
            userAnswer = randomQuestion.options[index];
          }
        }
        
        if (userAnswer === randomQuestion.answer) {
          await answer.reply(`✅ إجابة صحيحة! الجواب هو: ${randomQuestion.answer}`);
        } else {
          await answer.reply(`❌ إجابة خاطئة! الجواب الصحيح هو: ${randomQuestion.answer}`);
        }
      } catch (err) {
        await interaction.followUp(`⏰ انتهى الوقت! الجواب الصحيح هو: ${randomQuestion.answer}`);
      }
    }
  },

  // لعبة XO
  xo: {
    board: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
    currentPlayer: 'X',
    gameActive: true,
    checkWinner: function() {
      const winPatterns = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      for (const pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (this.board[a] === this.board[b] && this.board[b] === this.board[c]) return this.board[a];
      }
      if (!this.board.includes('1') && !this.board.includes('2') && !this.board.includes('3') &&
          !this.board.includes('4') && !this.board.includes('5') && !this.board.includes('6') &&
          !this.board.includes('7') && !this.board.includes('8') && !this.board.includes('9')) return 'تعادل';
      return null;
    },
    createBoard: function() {
      const rows = [];
      for (let i = 0; i < 3; i++) {
        const row = new ActionRowBuilder();
        for (let j = 0; j < 3; j++) {
          const index = i * 3 + j;
          row.addComponents(new ButtonBuilder()
            .setCustomId(`xo_${index}`)
            .setLabel(this.board[index])
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(this.board[index] === 'X' || this.board[index] === 'O'));
        }
        rows.push(row);
      }
      return rows;
    },
    execute: async function(interaction) {
      this.board.forEach((_, i) => this.board[i] = (i + 1).toString());
      this.currentPlayer = 'X';
      this.gameActive = true;
      
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('⭕ لعبة XO')
        .setDescription(`دور اللاعب: ${this.currentPlayer}`)
        .setFooter({ text: 'اختر خانة للعب!' });

      await interaction.reply({ embeds: [embed], components: this.createBoard() });
    },
    handleInteraction: async function(interaction) {
      const index = parseInt(interaction.customId.split('_')[1]);
      if (this.board[index] === 'X' || this.board[index] === 'O' || !this.gameActive) {
        await interaction.deferUpdate();
        return;
      }
      
      this.board[index] = this.currentPlayer;
      const winner = this.checkWinner();
      
      if (winner) {
        this.gameActive = false;
        const resultEmbed = new EmbedBuilder()
          .setColor(winner === 'تعادل' ? '#FFFF00' : '#00FF00')
          .setTitle(winner === 'تعادل' ? '🎲 تعادل!' : `🎉 فاز اللاعب ${winner}!`)
          .setDescription('انتهت اللعبة');
        
        await interaction.update({ embeds: [resultEmbed], components: this.createBoard() });
      } else {
        this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle('⭕ لعبة XO')
          .setDescription(`دور اللاعب: ${this.currentPlayer}`);
        
        await interaction.update({ embeds: [embed], components: this.createBoard() });
      }
    }
  },

  // لعبة الروليت
  roulette: {
    execute: async (interaction) => {
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🔫 لعبة الروليت الروسية')
        .setDescription('هل أنت مستلم للمخاطرة؟ هناك رصاصة واحدة في المسدس الذي به 6 chambers')
        .setFooter({ text: 'اضغط على الزر للعب!' });

      const row = new ActionRowBuilder()
        .addComponents(new ButtonBuilder().setCustomId('roulette_play').setLabel('🔫 اضغط للعب!').setStyle(ButtonStyle.Danger));

      await interaction.reply({ embeds: [embed], components: [row] });
    },
    handleInteraction: async (interaction) => {
      const bulletChamber = Math.floor(Math.random() * 6);
      const playerChamber = Math.floor(Math.random() * 6);
      
      if (bulletChamber === playerChamber) {
        const loseEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('💀 لقد ماتت!')
          .setDescription('كانت الرصاصة في الخزانة التي ضغطت عليها!');
        
        await interaction.update({ embeds: [loseEmbed], components: [] });
      } else {
        const winEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('🎉 لقد نجوت!')
          .setDescription('لم تكن الرصاصة في الخزانة التي ضغطت عليها!');
        
        await interaction.update({ embeds: [winEmbed], components: [] });
      }
    }
  },

  // لعبة السلوتس
  slots: {
    symbols: ['🍒', '🍋', '🍊', '🍇', '🍉', '💎', '7️⃣'],
    spinSlots: function() {
      return [
        this.symbols[Math.floor(Math.random() * this.symbols.length)],
        this.symbols[Math.floor(Math.random() * this.symbols.length)],
        this.symbols[Math.floor(Math.random() * this.symbols.length)]
      ];
    },
    calculateWin: function(result) {
      if (result[0] === '💎' && result[1] === '💎' && result[2] === '💎') return { win: true, multiplier: 10, message: '🎰 جاكبوت! فوز كبير!' };
      else if (result[0] === '7️⃣' && result[1] === '7️⃣' && result[2] === '7️⃣') return { win: true, multiplier: 5, message: '🎰 ثلاثة سبعات! فوز ممتاز!' };
      else if (result[0] === result[1] && result[1] === result[2]) return { win: true, multiplier: 3, message: '🎰 ثلاثة متشابهة! فوز جيد!' };
      else if (result[0] === result[1] || result[1] === result[2] || result[0] === result[2]) return { win: true, multiplier: 2, message: '🎰 اثنان متشابهان! فوز صغير!' };
      else return { win: false, multiplier: 0, message: '❌ لا يوجد فوز. حاول مرة أخرى!' };
    },
    execute: async function(interaction) {
      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎰 ماكينة السلوتس')
        .setDescription('اضغط على الزر للدوران ومحاولة الفوز!')
        .setFooter({ text: 'جرب حظك!' });

      const row = new ActionRowBuilder()
        .addComponents(new ButtonBuilder().setCustomId('slots_spin').setLabel('🎰 دور الآن!').setStyle(ButtonStyle.Primary));

      await interaction.reply({ embeds: [embed], components: [row] });
    },
    handleInteraction: async function(interaction) {
      const result = this.spinSlots();
      const winResult = this.calculateWin(result);
      
      const resultEmbed = new EmbedBuilder()
        .setColor(winResult.win ? '#00FF00' : '#FF0000')
        .setTitle('🎰 نتيجة السلوتس')
        .setDescription(`**${result.join(' | ')}**\n\n${winResult.message}`)
        .setFooter({ text: winResult.win ? `مضرب الفوز: x${winResult.multiplier}` : 'حظاً أوفر في المرة القادمة!' });
      
      await interaction.update({ embeds: [resultEmbed], components: [] });
    }
  },

  // لعبة التخمين
  hangman: {
    words: ['كمبيوتر', 'برمجة', 'ديسكورد', 'لعبة', 'إنترنت', 'تطبيق', 'هاتف', 'شاشة', 'لوحة'],
    maxAttempts: 6,
    currentWord: '',
    guessedLetters: [],
    attemptsLeft: 0,
    gameActive: false,
    getWordDisplay: function() {
      return this.currentWord
        .split('')
        .map(letter => this.guessedLetters.includes(letter) ? letter : '_')
        .join(' ');
    },
    getHangmanArt: function() {
      const stages = [
        `
        +---+
        |   |
            |
            |
            |
            |
        =========
        `,
        `
        +---+
        |   |
        O   |
            |
            |
            |
        =========
        `,
        `
        +---+
        |   |
        O   |
        |   |
            |
            |
        =========
        `,
        `
        +---+
        |   |
        O   |
       /|   |
            |
            |
        =========
        `,
        `
        +---+
        |   |
        O   |
       /|\\  |
            |
            |
        =========
        `,
        `
        +---+
        |   |
        O   |
       /|\\  |
       /    |
            |
        =========
        `,
        `
        +---+
        |   |
        O   |
       /|\\  |
       / \\  |
            |
        =========
        `
      ];
      
      return stages[this.maxAttempts - this.attemptsLeft];
    },
    execute: async function(interaction) {
      this.currentWord = this.words[Math.floor(Math.random() * this.words.length)];
      this.guessedLetters = [];
      this.attemptsLeft = this.maxAttempts;
      this.gameActive = true;
      
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🎮 لعبة التخمين (Hangman)')
        .setDescription(`الكلمة: ${this.getWordDisplay()}\n\nمحاولات متبقية: ${this.attemptsLeft}\n\n${this.getHangmanArt()}`)
        .setFooter({ text: 'اكتب حرفاً لتخمينه!' });

      await interaction.reply({ embeds: [embed] });
      
      // جمع التخمينات
      const filter = response => {
        return response.author.id === interaction.user.id && 
               response.content.length === 1 && 
               /[أ-ي]/.test(response.content);
      };

      const collector = interaction.channel.createMessageCollector({ filter, time: 60000 });

      collector.on('collect', async (message) => {
        const letter = message.content.toLowerCase();
        
        if (this.guessedLetters.includes(letter)) {
          await message.reply('لقد خمنت هذا الحرف مسبقاً!');
          return;
        }
        
        this.guessedLetters.push(letter);
        
        if (!this.currentWord.includes(letter)) {
          this.attemptsLeft--;
        }
        
        const wordDisplay = this.getWordDisplay();
        const isWin = !wordDisplay.includes('_');
        const isLose = this.attemptsLeft <= 0;
        
        const embed = new EmbedBuilder()
          .setColor(isWin ? '#00FF00' : isLose ? '#FF0000' : '#0099ff')
          .setTitle('🎮 لعبة التخمين (Hangman)')
          .setDescription(`الكلمة: ${wordDisplay}\n\nالحروف المُخمنة: ${this.guessedLetters.join(', ')}\n\nمحاولات متبقية: ${this.attemptsLeft}\n\n${this.getHangmanArt()}`)
          .setFooter({ text: isWin ? '🎉 فزت! الكلمة صحيحة!' : isLose ? `💀 خسرت! الكلمة كانت: ${this.currentWord}` : 'تابع التخمين!' });
        
        await interaction.editReply({ embeds: [embed] });
        
        if (isWin || isLose) {
          this.gameActive = false;
          collector.stop();
        }
      });

      collector.on('end', (collected, reason) => {
        if (reason === 'time') {
          interaction.followUp(`⏰ انتهى الوقت! الكلمة كانت: ${this.currentWord}`);
        }
      });
    }
  },

  // لعبة البنغو
  bingo: {
    numbers: [],
    generateCard: function() {
      const card = [];
      for (let i = 0; i < 5; i++) {
        const row = [];
        for (let j = 0; j < 5; j++) {
          const min = j * 15 + 1;
          const max = min + 14;
          row.push(Math.floor(Math.random() * (max - min + 1)) + min);
        }
        card.push(row);
      }
      card[2][2] = 'FREE'; // مركز المجانية
      return card;
    },
    execute: async function(interaction) {
      const card = this.generateCard();
      let cardDisplay = "```\n";
      for (let i = 0; i < 5; i++) {
        cardDisplay += card[i].map(num => String(num).padStart(4, ' ')).join(' ') + '\n';
      }
      cardDisplay += "```";
      
      const embed = new EmbedBuilder()
        .setColor('#FF9900')
        .setTitle('🎱 لعبة البنغو')
        .setDescription(`بطاقة البنغو الخاصة بك:\n${cardDisplay}`)
        .setFooter({ text: 'سيتم سحب الأرقام تلقائياً كل 10 ثوانٍ' });

      await interaction.reply({ embeds: [embed] });
      
      // محاكاة سحب الأرقام
      const numbers = Array.from({length: 75}, (_, i) => i + 1);
      for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
      }
      
      let drawnNumbers = [];
      let interval = setInterval(async () => {
        if (numbers.length === 0) {
          clearInterval(interval);
          await interaction.followUp('🎉 انتهت لعبة البنغو! جميع الأرقام تم سحبها.');
          return;
        }
        
        const drawnNumber = numbers.pop();
        drawnNumbers.push(drawnNumber);
        
        // تحديث البطاقة
        let updatedCardDisplay = "```\n";
        for (let i = 0; i < 5; i++) {
          updatedCardDisplay += card[i].map(num => {
            const strNum = String(num);
            return drawnNumbers.includes(num) ? strNum.padStart(4, ' ').replace(/\d/g, 'X') : strNum.padStart(4, ' ');
          }).join(' ') + '\n';
        }
        updatedCardDisplay += "```";
        
        const updatedEmbed = new EmbedBuilder()
          .setColor('#FF9900')
          .setTitle('🎱 لعبة البنغو')
          .setDescription(`بطاقة البنغو الخاصة بك:\n${updatedCardDisplay}\n\nالأرقام المسحوبة: ${drawnNumbers.join(', ')}`)
          .setFooter({ text: `تم سحب الرقم: ${drawnNumber}` });
        
        await interaction.editReply({ embeds: [updatedEmbed] });
      }, 10000);
    }
  },

  // أسئلة ثقافية
  trivia: {
    questions: [
      {
        question: "ما هو أسرع حيوان بري؟",
        answer: "الفهد"
      },
      {
        question: "كم عدد الأضلاع في جسم الإنسان؟",
        answer: "24"
      },
      {
        question: "ما هو أعمق محيط في العالم؟",
        answer: "المحيط الهادئ"
      },
      {
        question: "من هو مؤلف كتاب 'البؤساء'؟",
        answer: "فيكتور هوجو"
      },
      {
        question: "ما هو العنصر الكيميائي الذي رمزه 'Au'؟",
        answer: "الذهب"
      }
    ],
    execute: async function(interaction) {
      const randomQuestion = this.questions[Math.floor(Math.random() * this.questions.length)];
      
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🧠 أسئلة ثقافية')
        .setDescription(randomQuestion.question)
        .setFooter({ text: 'اكتب إجابتك في الدردشة!' });

      await interaction.reply({ embeds: [embed] });
      
      // جمع الإجابات
      const filter = response => response.author.id === interaction.user.id;
      
      try {
        const collected = await interaction.channel.awaitMessages({
          filter,
          max: 1,
          time: 30000,
          errors: ['time']
        });
        
        const answer = collected.first();
        
        if (answer.content.toLowerCase() === randomQuestion.answer.toLowerCase()) {
          await answer.reply(`✅ إجابة صحيحة! الجواب هو: ${randomQuestion.answer}`);
        } else {
          await answer.reply(`❌ إجابة خاطئة! الجواب الصحيح هو: ${randomQuestion.answer}`);
        }
      } catch (err) {
        await interaction.followUp(`⏰ انتهى الوقت! الجواب الصحيح هو: ${randomQuestion.answer}`);
      }
    }
  },

  // لعبة 21
  blackjack: {
    deck: [],
    playerHand: [],
    dealerHand: [],
    initializeDeck: function() {
      const suits = ['♥', '♦', '♣', '♠'];
      const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
      this.deck = [];
      
      for (const suit of suits) {
        for (const value of values) {
          this.deck.push({ value, suit });
        }
      }
      
      // خلط الورق
      for (let i = this.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
      }
    },
    calculateHandValue: function(hand) {
      let value = 0;
      let aces = 0;
      
      for (const card of hand) {
        if (card.value === 'A') {
          aces++;
          value += 11;
        } else if (['K', 'Q', 'J'].includes(card.value)) {
          value += 10;
        } else {
          value += parseInt(card.value);
        }
      }
      
      while (value > 21 && aces > 0) {
        value -= 10;
        aces--;
      }
      
      return value;
    },
    execute: async function(interaction) {
      this.initializeDeck();
      this.playerHand = [this.deck.pop(), this.deck.pop()];
      this.dealerHand = [this.deck.pop(), this.deck.pop()];
      
      const playerValue = this.calculateHandValue(this.playerHand);
      const dealerValue = this.calculateHandValue([this.dealerHand[0]]); // فقط البطاقة الأولى للتاجر
      
      const embed = new EmbedBuilder()
        .setColor('#006400')
        .setTitle('🃏 لعبة 21 (Blackjack)')
        .setDescription(`يدك: ${this.playerHand.map(card => `${card.value}${card.suit}`).join(' ')} (${playerValue})\n\nيد التاجر: ${this.dealerHand[0].value}${this.dealerHand[0].suit} ?`)
        .setFooter({ text: 'اختر: hit أو stand' });

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder().setCustomId('blackjack_hit').setLabel('Hit 🃏').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('blackjack_stand').setLabel('Stand ✋').setStyle(ButtonStyle.Success)
        );

      await interaction.reply({ embeds: [embed], components: [row] });
    },
    handleInteraction: async function(interaction) {
      if (interaction.customId === 'blackjack_hit') {
        this.playerHand.push(this.deck.pop());
        const playerValue = this.calculateHandValue(this.playerHand);
        
        if (playerValue > 21) {
          const loseEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('💥 لقد تجاوزت 21!')
            .setDescription(`يدك: ${this.playerHand.map(card => `${card.value}${card.suit}`).join(' ')} (${playerValue})\n\nلقد خسرت!`);
          
          await interaction.update({ embeds: [loseEmbed], components: [] });
          return;
        }
        
        const embed = new EmbedBuilder()
          .setColor('#006400')
          .setTitle('🃏 لعبة 21 (Blackjack)')
          .setDescription(`يدك: ${this.playerHand.map(card => `${card.value}${card.suit}`).join(' ')} (${playerValue})\n\nيد التاجر: ${this.dealerHand[0].value}${this.dealerHand[0].suit} ?`)
          .setFooter({ text: 'اختر: hit أو stand' });
        
        await interaction.update({ embeds: [embed] });
      } else if (interaction.customId === 'blackjack_stand') {
        // دور التاجر
        let dealerValue = this.calculateHandValue(this.dealerHand);
        while (dealerValue < 17) {
          this.dealerHand.push(this.deck.pop());
          dealerValue = this.calculateHandValue(this.dealerHand);
        }
        
        const playerValue = this.calculateHandValue(this.playerHand);
        
        let result;
        if (dealerValue > 21) {
          result = '🎉 التاجر تجاوز 21! لقد فزت!';
        } else if (dealerValue > playerValue) {
          result = '💀 التاجر فاز!';
        } else if (dealerValue < playerValue) {
          result = '🎉 لقد فزت!';
        } else {
          result = '🤝 تعادل!';
        }
        
        const resultEmbed = new EmbedBuilder()
          .setColor(dealerValue > 21 || playerValue > dealerValue ? '#00FF00' : '#FF0000')
          .setTitle('🃏 نتيجة لعبة 21')
          .setDescription(`يدك: ${this.playerHand.map(card => `${card.value}${card.suit}`).join(' ')} (${playerValue})\n\nيد التاجر: ${this.dealerHand.map(card => `${card.value}${card.suit}`).join(' ')} (${dealerValue})\n\n${result}`);
        
        await interaction.update({ embeds: [resultEmbed], components: [] });
      }
    }
  },

  // اليانصيب
  lotto: {
    execute: async function(interaction) {
      const numbers = [];
      while (numbers.length < 6) {
        const num = Math.floor(Math.random() * 49) + 1;
        if (!numbers.includes(num)) numbers.push(num);
      }
      numbers.sort((a, b) => a - b);
      
      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎫 يانصيب اليوم')
        .setDescription(`**الأرقام الفائزة: ${numbers.join(' - ')}**\n\nجرب حظك في المرة القادمة!`)
        .setFooter({ text: 'اليانصيب يعقد يومياً في منتصف الليل' });

      await interaction.reply({ embeds: [embed] });
    }
  },

  // عجلة الحظ
  wheel: {
    prizes: ['100 نقطة', 'جائزة صغيرة', 'جائزة كبيرة', 'لا شيء', 'فرصة أخرى', '500 نقطة', '1000 نقطة', 'خسارة'],
    execute: async function(interaction) {
      const embed = new EmbedBuilder()
        .setColor('#FF69B4')
        .setTitle('🎡 عجلة الحظ')
        .setDescription('اضغط على الزر لتدوير العجلة والفوز بجائزة!')
        .setFooter({ text: 'الجوائز: ' + this.prizes.join(', ') });

      const row = new ActionRowBuilder()
        .addComponents(new ButtonBuilder().setCustomId('wheel_spin').setLabel('🎡 دور العجلة!').setStyle(ButtonStyle.Primary));

      await interaction.reply({ embeds: [embed], components: [row] });
    },
    handleInteraction: async function(interaction) {
      const spinResult = this.prizes[Math.floor(Math.random() * this.prizes.length)];
      
      const resultEmbed = new EmbedBuilder()
        .setColor('#FF69B4')
        .setTitle('🎡 نتيجة عجلة الحظ')
        .setDescription(`**لقد فزت بـ: ${spinResult}!**`)
        .setFooter({ text: spinResult === 'لا شيء' ? 'حظاً أوفر في المرة القادمة!' : 'مبروك على الفوز!' });
      
      await interaction.update({ embeds: [resultEmbed], components: [] });
    }
  },

  // لعبة النرد
  dice: {
    execute: async function(interaction) {
      const embed = new EmbedBuilder()
        .setColor('#6A0DAD')
        .setTitle('🎲 لعبة النرد')
        .setDescription('اضغط على الزر لرمي النرد!')
        .setFooter({ text: 'جرب حظك!' });

      const row = new ActionRowBuilder()
        .addComponents(new ButtonBuilder().setCustomId('dice_roll').setLabel('🎲 ارمي النرد!').setStyle(ButtonStyle.Primary));

      await interaction.reply({ embeds: [embed], components: [row] });
    },
    handleInteraction: async function(interaction) {
      const dice1 = Math.floor(Math.random() * 6) + 1;
      const dice2 = Math.floor(Math.random() * 6) + 1;
      const total = dice1 + dice2;
      
      const resultEmbed = new EmbedBuilder()
        .setColor('#6A0DAD')
        .setTitle('🎲 نتيجة رمي النرد')
        .setDescription(`**${dice1} + ${dice2} = ${total}**`)
        .setFooter({ text: total === 7 ? '🎉 حظ سعيد! الرقم 7!' : 'جرب مرة أخرى!' });
      
      await interaction.update({ embeds: [resultEmbed], components: [] });
    }
  },

  // تخمين الأرقام
  guess: {
    targetNumber: 0,
    attempts: 0,
    gameActive: false,
    execute: async function(interaction) {
      this.targetNumber = Math.floor(Math.random() * 100) + 1;
      this.attempts = 0;
      this.gameActive = true;
      
      const embed = new EmbedBuilder()
        .setColor('#FF8C00')
        .setTitle('🔢 تخمين الرقم')
        .setDescription('لقد اخترت رقمًا بين 1 و 100. هل يمكنك تخمينه؟')
        .setFooter({ text: 'اكتب رقمًا بين 1 و 100!' });

      await interaction.reply({ embeds: [embed] });
      
      // جمع التخمينات
      const filter = response => {
        return response.author.id === interaction.user.id && 
               !isNaN(response.content) && 
               parseInt(response.content)
               >= 1 && 
               parseInt(response.content) <= 100;
      };

      const collector = interaction.channel.createMessageCollector({ filter, time: 60000 });

      collector.on('collect', async (message) => {
        this.attempts++;
        const guess = parseInt(message.content);
        
        if (guess === this.targetNumber) {
          this.gameActive = false;
          const winEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🎉 لقد فزت!')
            .setDescription(`لقد خمنت الرقم الصحيح ${this.targetNumber} في ${this.attempts} محاولة!`);
          
          await interaction.editReply({ embeds: [winEmbed] });
          collector.stop();
        } else if (guess < this.targetNumber) {
          await message.reply('🔺 الرقم أكبر من ذلك! حاول مرة أخرى.');
        } else {
          await message.reply('🔻 الرقم أصغر من ذلك! حاول مرة أخرى.');
        }
      });

      collector.on('end', (collected, reason) => {
        if (reason === 'time' && this.gameActive) {
          interaction.followUp(`⏰ انتهى الوقت! الرقم كان: ${this.targetNumber}`);
        }
      });
    }
  },

  // لعبة الكلمات
  wordle: {
    words: ['كمبيوتر', 'برمجة', 'ديسكورد', 'لعبة', 'إنترنت', 'تطبيق', 'هاتف', 'شاشة', 'لوحة'],
    targetWord: '',
    maxAttempts: 6,
    attempts: [],
    gameActive: false,
    execute: async function(interaction) {
      this.targetWord = this.words[Math.floor(Math.random() * this.words.length)];
      this.attempts = [];
      this.gameActive = true;
      
      const embed = new EmbedBuilder()
        .setColor('#4B0082')
        .setTitle('📝 لعبة Wordle')
        .setDescription('خمن الكلمة المكونة من 5 أحرف! لديك 6 محاولات.')
        .setFooter({ text: 'اكتب كلمة من 5 أحرف!' });

      await interaction.reply({ embeds: [embed] });
      
      // جمع المحاولات
      const filter = response => {
        return response.author.id === interaction.user.id && 
               response.content.length === 5 && 
               /[أ-ي]{5}/.test(response.content);
      };

      const collector = interaction.channel.createMessageCollector({ filter, time: 120000 });

      collector.on('collect', async (message) => {
        const guess = message.content.toLowerCase();
        this.attempts.push(guess);
        
        let display = '';
        for (const attempt of this.attempts) {
          for (let i = 0; i < 5; i++) {
            if (attempt[i] === this.targetWord[i]) {
              display += '🟩'; // حرف صحيح في المكان الصحيح
            } else if (this.targetWord.includes(attempt[i])) {
              display += '🟨'; // حرف صحيح في المكان الخطأ
            } else {
              display += '⬛'; // حرف خاطئ
            }
          }
          display += '\n';
        }
        
        if (guess === this.targetWord) {
          this.gameActive = false;
          const winEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🎉 لقد فزت!')
            .setDescription(`الكلمة الصحيحة: ${this.targetWord}\n\n${display}`)
            .setFooter({ text: `فزت في ${this.attempts.length} محاولة!` });
          
          await interaction.editReply({ embeds: [winEmbed] });
          collector.stop();
        } else if (this.attempts.length >= this.maxAttempts) {
          this.gameActive = false;
          const loseEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('💀 لقد خسرت!')
            .setDescription(`الكلمة الصحيحة: ${this.targetWord}\n\n${display}`)
            .setFooter({ text: 'انتهت المحاولات!' });
          
          await interaction.editReply({ embeds: [loseEmbed] });
          collector.stop();
        } else {
          const progressEmbed = new EmbedBuilder()
            .setColor('#4B0082')
            .setTitle('📝 لعبة Wordle - المحاولة ' + this.attempts.length)
            .setDescription(display)
            .setFooter({ text: `${this.maxAttempts - this.attempts.length} محاولات متبقية` });
          
          await interaction.editReply({ embeds: [progressEmbed] });
        }
      });

      collector.on('end', (collected, reason) => {
        if (reason === 'time' && this.gameActive) {
          interaction.followUp(`⏰ انتهى الوقت! الكلمة كانت: ${this.targetWord}`);
        }
      });
    }
  },

  // اختبار السرعة في الكتابة
  typing: {
    texts: [
      "التقنية تغير العالم بسرعة كبيرة",
      "البرمجة هي لغة المستقبل المشرق",
      "التعلم المستمر هو مفتاح النجاح في الحياة",
      "الذكاء الاصطناعي يغير شكل الصناعات",
      "الابتكار يجعل الحياة أفضل للجميع"
    ],
    execute: async function(interaction) {
      const randomText = this.texts[Math.floor(Math.random() * this.texts.length)];
      
      const embed = new EmbedBuilder()
        .setColor('#00CED1')
        .setTitle('⌨️ اختبار سرعة الكتابة')
        .setDescription(`**اكتب النص التالي بأسرع ما يمكن:**\n\n${randomText}`)
        .setFooter({ text: 'سيبدأ العد عند كتابتك لأول حرف!' });

      await interaction.reply({ embeds: [embed] });
      
      const startTime = Date.now();
      let typedCorrectly = false;
      
      const filter = response => response.author.id === interaction.user.id;
      
      try {
        const collected = await interaction.channel.awaitMessages({
          filter,
          max: 1,
          time: 60000,
          errors: ['time']
        });
        
        const endTime = Date.now();
        const timeTaken = (endTime - startTime) / 1000; // بالثواني
        const userText = collected.first().content;
        
        if (userText === randomText) {
          typedCorrectly = true;
          const wpm = Math.round((randomText.length / 5) / (timeTaken / 60));
          
          const resultEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🎉 نتيجة اختبار السرعة')
            .setDescription(`**الوقت: ${timeTaken.toFixed(2)} ثانية**\n**السرعة: ${wpm} كلمة/دقيقة**`)
            .setFooter({ text: 'أداء ممتاز!' });
          
          await collected.first().reply({ embeds: [resultEmbed] });
        } else {
          await collected.first().reply('❌ النص غير مطابق! حاول مرة أخرى.');
        }
      } catch (err) {
        await interaction.followUp('⏰ انتهى الوقت! لم تكتب أي شيء.');
      }
    }
  },

  // مسائل رياضية
  math: {
    generateProblem: function() {
      const operations = ['+', '-', '*'];
      const op = operations[Math.floor(Math.random() * operations.length)];
      let a, b, answer;
      
      if (op === '+') {
        a = Math.floor(Math.random() * 50) + 1;
        b = Math.floor(Math.random() * 50) + 1;
        answer = a + b;
      } else if (op === '-') {
        a = Math.floor(Math.random() * 50) + 1;
        b = Math.floor(Math.random() * a) + 1;
        answer = a - b;
      } else { // *
        a = Math.floor(Math.random() * 12) + 1;
        b = Math.floor(Math.random() * 12) + 1;
        answer = a * b;
      }
      
      return { problem: `${a} ${op} ${b}`, answer };
    },
    execute: async function(interaction) {
      const { problem, answer } = this.generateProblem();
      
      const embed = new EmbedBuilder()
        .setColor('#8A2BE2')
        .setTitle('🧮 مسألة رياضية')
        .setDescription(`**حل المسألة التالية:**\n\n# ${problem} = ?`)
        .setFooter({ text: 'لديك 15 ثانية للإجابة!' });

      await interaction.reply({ embeds: [embed] });
      
      const filter = response => {
        return response.author.id === interaction.user.id && 
               !isNaN(response.content);
      };

      try {
        const collected = await interaction.channel.awaitMessages({
          filter,
          max: 1,
          time: 15000,
          errors: ['time']
        });
        
        const userAnswer = parseInt(collected.first().content);
        
        if (userAnswer === answer) {
          await collected.first().reply(`✅ إجابة صحيحة! الناتج هو: ${answer}`);
        } else {
          await collected.first().reply(`❌ إجابة خاطئة! الناتج الصحيح هو: ${answer}`);
        }
      } catch (err) {
        await interaction.followUp(`⏰ انتهى الوقت! الناتج الصحيح هو: ${answer}`);
      }
    }
  }
};

// تسجيل الأوامر مع Discord
const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
  try {
    console.log('بدأ تسجيل الأوامر...');
    await rest.put(
      Routes.applicationCommands(config.clientId),
      { body: commands }
    );
    console.log('تم تسجيل الأوامر بنجاح!');
  } catch (error) {
    console.error('خطأ في تسجيل الأوامر:', error);
  }
})();

// حدث عند اتصال البوت
client.on('ready', () => {
  console.log(`✅ ${client.user.tag} يعمل الآن!`);
  client.user.setActivity('ألعاب تفاعلية | /help');
});

// معالجة الأوامر
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (gameDefinitions[commandName]) {
    gamesPlayed++;
    await gameDefinitions[commandName].execute(interaction);
  }
});

// معالجة تفاعلات الأزرار
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const [gameName] = interaction.customId.split('_');
  
  if (gameDefinitions[gameName] && gameDefinitions[gameName].handleInteraction) {
    await gameDefinitions[gameName].handleInteraction(interaction);
  }
});

// أمر المساعدة
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'help') {
    const helpEmbed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('🎮 أوامر الألعاب المتاحة')
      .setDescription('إليك قائمة بجميع الألعاب المتاحة:')
      .addFields(
        { name: '🎮 الألعاب التفاعلية', value: '/rps - حجرة ورقة مقص\n/xo - لعبة XO\n/roulette - الروليت الروسية\n/slots - ماكينات القمار\n/blackjack - لعبة 21\n/dice - لعبة النرد\n/wheel - عجلة الحظ' },
        { name: '🧠 ألعاب الذكاء', value: '/quiz - أسئلة عامة\n/trivia - معلومات ثقافية\n/hangman - لعبة التخمين\n/wordle - تخمين الكلمات\n/guess - تخمين الأرقام\n/math - مسائل رياضية' },
        { name: '🎲 ألعاب الحظ', value: '/lotto - اليانصيب\n/bingo - البنغو' },
        { name: '⏰ ألعاب السرعة', value: '/typing - اختبار سرعة الكتابة' }
      )
      .setFooter({ text: `تم لعب ${gamesPlayed} لعبة حتى الآن!` });

    await interaction.reply({ embeds: [helpEmbed] });
  }
});

// تسجيل الدخول بالتوكن
client.login(config.token);
// تسجيل الدخول إلى البوت
client.login('MTQxNDI0NTk5MjAxNzk1Njk1OA.GnicBd.lB2Yy0znK84mB2UlpwD5YIuBLX9AyuUq6RTkn0');