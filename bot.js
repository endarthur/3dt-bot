// https://medium.com/davao-js/tutorial-creating-a-simple-discord-bot-9465a2764dc0
var Discord = require('discord.io');
var winston = require('winston');
var LZString = require('./lz-string.min.js');
var auth = require('./auth.json');
var fs = require('fs');
var fichas_backup = require('./fichas.json');
var ficha_por_usuario_total = require('./fichas_usuarios.json');;
var rpg = true;

function d6(modificador) {
    return Math.floor((Math.random() * 6) + 1 + modificador);
}

// function checar_ficha(nome) {
//     return fichas[nome] != undefined;
// }

function resplit_on_comma(list) {
    return list.join(" ").split(",").map(s => { return s.trim() })
}

class Ficha {
    constructor(nome, caracteristicas, vantagens = [], desvantagens = [], equipamentos = [], pv = undefined, pm = undefined) {
        this.nome = nome;
        this.caracteristicas = caracteristicas;
        this.F = caracteristicas[0];
        this.H = caracteristicas[1];
        this.R = caracteristicas[2];
        this.A = caracteristicas[3];
        this.PdF = caracteristicas[4];

        if (pv != undefined){
            this.pv = pv;
        } else {
            this.pv = this.R * 5;
        }
        if (pm != undefined){
            this.pm = pm;
        } else {
            this.pm = this.R * 5;
        }

        this.vantagens = vantagens;
        this.desvantagens = desvantagens;
        this.equipamentos = equipamentos;
    }
    get texto_ficha() {
        var texto_vantagens = this.vantagens.length > 0 ? this.vantagens.join(", ") : "---";
        var texto_desvantagens = this.desvantagens.length > 0 ? this.desvantagens.join(", ") : "---";
        var texto_equipamentos = this.equipamentos.length > 0 ? this.equipamentos.join(", ") : "---";
        return `
    ${this.nome}: F: ${this.F} H: ${this.H} R: ${this.R} A: ${this.A} PdF: ${this.PdF} PV: ${this.pv}/${this.R * 5} PM: ${this.pm}/${this.R * 5}
    vantagens: ${texto_vantagens}
    desvantagens: ${texto_desvantagens}
    equipamentos: ${texto_equipamentos}
        `;
    }
    ataque_forca() {
        return `1d6+F(${this.F})+H(${this.H}): ${d6(this.F + this.H)}`
    }
    ataque_pdf() {
        return `1d6+F(${this.PdF})+H(${this.H}): ${d6(this.PdF + this.H)}`
    }
    defesa() {
        return `1d6+A(${this.A})+H(${this.H}): ${d6(this.A + this.H)}`
    }
    iniciativa() {
        return `1d6+H(${this.H}): ${d6(this.H)}`
    }
    teste(caracteristica) {
        var valor = this[caracteristica];

        if (valor != undefined) {
            return `1d6-${caracteristica}(${valor}): ${d6(-valor)}`
        } else {
            return `Característica inválida.`
        }
    }
    equipar(item) {
        this.equipamentos.push(item);
    }
    desequipar(item) {
        this.equipamentos = this.equipamentos.filter(function (value, index, arr) {
            return value != item;
        })
    }
    resetar_pv() {
        this.pv = this.R * 5;
    }
    resetar_pm() {
        this.pm = this.R * 5;
    }
}



// Configure logger settings
const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.json(),
    transports: [
        //
        // - Write to all logs with level `info` and below to `combined.log` 
        // - Write all logs error (and below) to `error.log`.
        //
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console({ colorize: true })
    ]
});


// Initialize Discord Bot
var bot = new Discord.Client({
    token: auth.token,
    autorun: true
});
bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
});

var fichas_total = {};
for (var canal in fichas_backup){
    fichas_total[canal] = {};
    var fichas_canal = fichas_backup[canal];
    for (var ficha in fichas_canal) {
        fichas_total[canal][ficha] = new Ficha(fichas_canal[ficha].nome, fichas_canal[ficha].caracteristicas, fichas_canal[ficha].vantagens, fichas_canal[ficha].desvantagens, fichas_canal[ficha].equipamentos, fichas_canal[ficha].pv, fichas_canal[ficha].pm);
    }
}

bot.on('message', function (user, userID, channelID, message, evt) {
    // Our bot needs to know if it will execute a command
    // It will listen for messages that will start with `!`
    var canal = `${channelID}`;
    var fichas = fichas_total[canal];
    var ficha_por_usuario = ficha_por_usuario_total[canal];
    if (fichas === undefined){
        fichas_total[canal] = {};
        fichas = fichas_total[canal];
    }
    if (ficha_por_usuario === undefined){
        ficha_por_usuario_total[canal] = {};
        ficha_por_usuario = ficha_por_usuario_total[canal];
    }

    // logger.info(`${channelID}`);
    if (message.startsWith("!rpg")) {
        rpg = !rpg;
        if (rpg) {
            bot.sendMessage({
                to: channelID,
                message: "RPG ligado."
            });
        } else {
            bot.sendMessage({
                to: channelID,
                message: "RPG desligado."
            });
        }
    } else if (rpg) {
        var args = message.split(/\s+/);
        var personagem = "";
        var personagem_default = false;
        if (args.length > 1) {
            // logger.info(`checando ficha: ${args[1]}`);
            if (fichas[args[1]] != undefined) {
                personagem = args[1];
            } else if (ficha_por_usuario[user] != undefined) {
                personagem = ficha_por_usuario[user];
                personagem_default = true;
            }
        } else if (ficha_por_usuario[user] != undefined) {
            personagem = ficha_por_usuario[user];
            personagem_default = true;
        }
        // logger.info(`ficha: ${personagem}`);
        if (args[0] === "help") {
            bot.sendMessage({
                to: channelID,
                message: `Versão de 2018-07-30 do 3D&Bot
                Módulo de RPG:
                    * rolar um dado:
                      d modificador
                    * criar uma ficha:
                      f nome_do_personagem força,habilidade,resistência,armadura,poderdefogo
                    * adicionar vantagens:
                      vantagens nome_do_personagem vantagem1 vantagem2 ...
                    * adicionar desvantagens:
                      desvantagens nome_do_personagem desvantagem1 desvantagem2 ...
                    * adicionar equipamentos:
                      equipamentos nome_do_personagem equipamento1 equipamento2 ...
                    * equipar um equipamento
                      equipar nome_do_personagem item
                    * desequipar um equipamento
                      desequipar nome_do_personagem item
                    * ver sua ficha
                      f nome_do_personagem
                    * atacar:
                        * usando força:
                            af nome_do_personagem
                        * usando Poder de Fogo:
                            ap nome_do_personagem
                    * testes:
                        t nome_do_personagem nome_da_caraterística
                    * mudar pontos de vida:
                        pv nome_do_personagem valor_de_mudança
                    * mudar pontos de magia:
                        pm nome_do_personagem valor_de_mudança
                O campo nome do personagem é opcional se você já tiver criado um personagem antes.
                Neste caso, ele irá usar como padrão o último personagem que você criou. Se quiser mudar o padrão,
                use o comando:
                    pegar_ficha nome_do_personagem_novo
                Com isso, o personagem padrão será o que você nomeou no comando.`
            })
        } else if (args[0] === "d") {
            var modificador;
            var modificador_texto = "";
            if (message.split(" ").length === 1 || isNaN(modificador = parseInt(message.split(" ")[1]))) {
                modificador = 0;
            }
            if (modificador != 0) {
                modificador_texto = `${modificador > 0 ? "+" : ""}${modificador}`;
            }
            bot.sendMessage({
                to: channelID,
                message: `1d6${modificador_texto}: ${Math.floor((Math.random() * 6) + 1) + modificador}`
            });
        } else if (args[0] === "f") {
            // logger.info(`fichas ${args}`);
            if (args.length == 3) {
                var caracteristicas = args[2].split(",").map(parseFloat);
                // logger.info(`caracteristicas ${args[2].split(",")} ${caracteristicas}`);
                fichas[args[1]] = new Ficha(args[1], caracteristicas, [], [], []);
                ficha_por_usuario[user] = args[1];
                bot.sendMessage({
                    to: channelID,
                    message: `${user} criou a ficha:
                    ${fichas[args[1]].texto_ficha}`
                });
            } else if (personagem != "") {
                logger.info(`imprimindo ficha do personagem ${personagem}`);
                bot.sendMessage({
                    to: channelID,
                    message: fichas[personagem].texto_ficha
                });
            } else {
                logger.info(`ficha não encontrada`);
                bot.sendMessage({
                    to: channelID,
                    message: `Ficha não encontrada: ${args[1]}`
                });
            }
        } if (personagem != "") {
            if (args[0] === "af") {
                bot.sendMessage({
                    to: channelID,
                    message: fichas[personagem].ataque_forca()
                });
            } else if (args[0] === "ap") {
                bot.sendMessage({
                    to: channelID,
                    message: fichas[personagem].ataque_pdf()
                });
            } else if (args[0] === "def") {
                bot.sendMessage({
                    to: channelID,
                    message: fichas[personagem].defesa()
                });
            } else if (args[0] === "ini") {
                bot.sendMessage({
                    to: channelID,
                    message: fichas[personagem].iniciativa()
                });
            } else if (args[0] === "t") {
                bot.sendMessage({
                    to: channelID,
                    message: fichas[personagem].teste(args[personagem_default ? 1 : 2])
                });
            } else if (args[0] === "pv") {
                if (args.length >= 2) {
                    var valor = parseFloat(args[personagem_default ? 1 : 2]);
                    if (valor != undefined && !isNaN(valor)) {
                        fichas[personagem].pv += valor;
                    }
                    if (args[personagem_default ? 1 : 2] === "max") {
                        fichas[personagem].resetar_pv();
                    }
                }
                bot.sendMessage({
                    to: channelID,
                    message: `${personagem}: ${fichas[personagem].pv}/${fichas[personagem].R * 5}`
                });
            } else if (args[0] === "pm") {
                if (args.length >= 2) {
                    var valor = parseFloat(args[personagem_default ? 1 : 2]);
                    if (valor != undefined && !isNaN(valor)) {
                        fichas[personagem].pm += valor;
                    }
                    if (args[personagem_default ? 1 : 2] === "max") {
                        fichas[personagem].resetar_pm();
                    }
                }
                bot.sendMessage({
                    to: channelID,
                    message: `${personagem}: ${fichas[personagem].pm}/${fichas[personagem].R * 5}`
                });
            } else if (args[0] === "pegar_ficha") {
                if (personagem === ficha_por_usuario[user]) return;
                ficha_por_usuario[user] = args[1];
                bot.sendMessage({
                    to: channelID,
                    message: `${user} trocou de ficha padrão para:
                    ${fichas[personagem].texto_ficha}`
                });
            } else if (args[0] === "vantagens") {
                if (args.length >= 2) {
                    fichas[personagem].vantagens = resplit_on_comma(args.slice(personagem_default ? 1 : 2));
                }
            } else if (args[0] === "desvantagens") {
                if (args.length >= 2) {
                    fichas[personagem].desvantagens = resplit_on_comma(args.slice(personagem_default ? 1 : 2));
                }
            } else if (args[0] === "equipamento" || args[0] === "equipamentos") {
                if (args.length >= 2) {
                    fichas[personagem].equipamentos = resplit_on_comma(args.slice(personagem_default ? 1 : 2));
                }
            } else if (args[0] === "equipar") {
                if (args.length >= 2) {
                    fichas[personagem].equipar(args.slice(personagem_default ? 1 : 2).join(" "));
                }
            } else if (args[0] === "desequipar") {
                if (args.length >= 2) {
                    fichas[personagem].desequipar(args.slice(personagem_default ? 1 : 2).join(" "));
                }
            } else if (args[0] === "!export") {
                // logger.info('exporting');
                bot.sendMessage({
                    to: channelID,
                    message: `https://endarthur.github.io/csheet.html#${LZString.compressToEncodedURIComponent(JSON.stringify(fichas[personagem]))}`
                });
            }
        }

    }

    fs.writeFile("fichas.json", JSON.stringify(fichas_total), "utf8", (err) => {
        if (err) throw err;
    });

    fs.writeFile("fichas_usuarios.json", JSON.stringify(ficha_por_usuario_total), "utf8", (err) => {
        if (err) throw err;
    });
    // bot.sendMessage({
    //     to: channelID,
    //     message: `Manual embutido anti-desculpas pra não jogar RPG
    //     Características:
    //         * F -- Força
    //         * H -- Habilidade
    //         * R -- Resistência
    //         * A -- Armadura
    //         * PdF -- Adobe Portable Document Format

    //         * PV = R*5 -- Pontos de vida
    //         * PM = R*5 -- Pontos de Magia
    //     Testes:
    //         1d6 contra alguma coisa, em geral H
    //     Combate:
    //         Ataque:
    //             F+H+1d6
    //             --ou--
    //             Pdf+H+1d6
    //         Defesa:
    //             H+A+1d6
    //     Vantagens e Desvantagens:
    //         Vantagens (custo):
    //             Aceleração (1):
    //                 H+1 para testes de fuga e move duas vezes por turno
    //             Ataque Múltiplo (1):
    //                 gasta 1 PM para dar mais de um ataque por turno
    //             Boa Fama (1):
    //                 todo mundo gosta de você
    //             Imortal (1/2):
    //                 1: você revive depois de um tempo
    //                 2: você revive no fim do combate
    //         Desvantagens (bonus):
    //             Munição limitada (1):
    //                 você tem munição limitada para ataques com PdF
    //             Maldição (1/2):
    //                 1: algo irritante
    //                 2: algo que pode por sua vida em risco
    //             Ponto fraco (1):
    //                 seus inimogos tem H+1 se souberem seu ponto fraco
    //         Distribuição de pontos:
    //             em geral 12, 5 para personagens beeem fracos. Devem ser
    //             distribuidos entre as características e vantagens.`
    // })
});