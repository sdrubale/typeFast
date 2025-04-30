const express = require('express');
const {readFileSync}=require('fs');

const parole = readFileSync('./parole.txt','utf8').split(", ");

const server = express()
  .use((req, res) => res.sendFile('/index.html', { root: __dirname }))
  .listen(3000, () => console.log('Listening on 3000'));
  
const { Server } = require('ws');

const ws_server = new Server({ server });

// -------------------
let numRound = 0;
let statoGioco = "";
let prossimoId = 0;
let nomiPlayer = [];
let numParolePerRound = 10;
let iParolePlayer = [];
let paroleRound = [];
let tempoInizioRound;
const tempoRound = 30;
let tempoRoundAttuale = tempoRound;
let numLeaderboard = 0;
let punteggi = [];
let giocatoriInLeaderboard = [];

function iniziareNuovoRound() {
   iParolePlayer = [];
   numLeaderboard = 0;
   giocatoriInLeaderboard = [];
   paroleRound = [];
   pulireLeaderboard();

   numRound++;
   statoGioco = "Round " + numRound;
   let iParoleRound = [];
   for(let i = 0; i < numParolePerRound; i++) {
      let nuovaI;
      do{
         nuovaI = parseInt(Math.random() * parole.length);
      }while(iParolePlayer.includes(nuovaI));
      iParoleRound[i] = nuovaI;
   }

   for(let i = 0; i < numParolePerRound; i++) {
      paroleRound[i] = parole[iParoleRound[i]];
   }

   const data = JSON.stringify({"azione": "nuovoRound", "statoGioco": statoGioco, "paroleRound": paroleRound});
	ws_server.clients.forEach((client) => {
      client.send(data);
   });
   
   for(let i = 0; i < prossimoId; i++) {
      iParolePlayer[i] = 0;
   }
   tempoInizioRound = new Date();
   tempoRoundAttuale = tempoRound;
   tempoTraRound(tempoRound, numRound);
}


async function terminarePartita() {
   statoGioco = "Fine partita";
   let indiciGiocatori = [];
   for(let i = 0; i < punteggi.length - 1; i++) {
      for(let j = i + 1; j < punteggi.length; j++) {
         if(punteggi[i] < punteggi[j]) {
            let scambio = punteggi[i];
            punteggi[i] = punteggi[j];
            punteggi[j] = scambio;
            indiciGiocatori[i] = j;
         }
      }
   }

   let indiciTotali = [];
   for(let i = 0; i < punteggi.length; i++){
      indiciTotali[i] = i;
   }

   let arrayNomi = [];
   if(indiciGiocatori.length > 0) {
      for(let i = 0; i < punteggi.length; i++) {
         arrayNomi[i] = nomiPlayer[indiciGiocatori[i]];
         indiciTotali.splice(indiciGiocatori[i], 1);
      }
   }
   
   arrayNomi[punteggi.length - 1] = nomiPlayer[indiciTotali[0]];

   const data = JSON.stringify({"azione": "finirePartita", "leaderboard": arrayNomi, "punteggio": punteggi, "statoGioco": statoGioco});
	ws_server.clients.forEach((client) => {
      client.send(data);
   });

   await sleep(10000);

   for(let i = 0; i < prossimoId; i++) {
      punteggi[i] = 0;
   }
   numRound = 0;
   iniziareNuovoRound();
}


async function tempoTraRound(secondiRound, round) {
   await sleep(secondiRound * 1000);
   if(statoGioco == "Round " + round) {
      iniziareAttesaTraRound();
   }
}

function aggiornareLeaderboard(iPlayer) {
   let nuovoElemento = nomiPlayer[iPlayer] + " " + ((new Date() - tempoInizioRound) / 1000);
   giocatoriInLeaderboard[numLeaderboard] = iPlayer;
   punteggi[iPlayer] += parseInt(10 / (numLeaderboard + 1)); 
   const data = JSON.stringify({"azione": "aggiornareLeaderboard", "nuovo": nuovoElemento, "punteggio": punteggi[iPlayer]});
	ws_server.clients.forEach((client) => {
      client.send(data);
   });
   numLeaderboard++;
}

function pulireLeaderboard() {
   const data = JSON.stringify({"azione": "pulireLeaderboard"});
	ws_server.clients.forEach((client) => {
      client.send(data);
   });
}

async function iniziareAttesaTraRound() {
   console.log("cambioTraRound");
   if(numRound < 3)
   {
      for(let i = 0; i < 5; i++) {
         statoGioco = "Nuovo round in " + (5 - i);
         const data = JSON.stringify({"azione": "attendereRound", "statoGioco": statoGioco});
         ws_server.clients.forEach((client) => {
            client.send(data);
         });
         await sleep(1000);
      }
      iniziareNuovoRound();
   } else {
      terminarePartita();
   }
}

iniziareAttesaTraRound();

ws_server.on('connection', (ws) => { 
        
   ws.on('close', () => {
      console.log("esce:"+ws.id);
   });	   
   
   ws.on('message', (message) => {   
	   
      const messaggio = JSON.parse(message);
      
      if(messaggio.azione=="entra") {
         ws.id=prossimoId;
         nomiPlayer[ws.id] = messaggio.nome;
         prossimoId++;
         console.log("nuovo:" + nomiPlayer[ws.id]);
         let data = JSON.stringify({chi: nomiPlayer[ws.id], azione: "entra"});
         ws.send(data);
         data = JSON.stringify({"azione": "aggiornareStatoGioco", "statoGioco": "Attendi la fine del round in corso"});
         ws.send(data);
         punteggi[ws.id] = 0;
      }

      if(messaggio.azione == "scrivereParola") {
         if(messaggio.parola == paroleRound[iParolePlayer[ws.id]]) {
            iParolePlayer[ws.id]++;
            if(iParolePlayer[ws.id] == numParolePerRound) {
               aggiornareLeaderboard(ws.id);
            }
            const data = JSON.stringify({azione: "aggiornareParole"});
            ws.send(data);
         }
      }
      if(messaggio.azione == "usarePotere") {
         switch (messaggio.potere) {
            case "aggiungiParola":
               if(!giocatoriInLeaderboard.includes(ws.id) || punteggi[ws.id] < 3) {
                  return;
               }
               punteggi[ws.id] -= 3;
               let nuovaI;
               do{
                  nuovaI = parseInt(Math.random() * parole.length);
               }while(paroleRound.includes(parole[nuovaI]));
               paroleRound[paroleRound.length] = parole[nuovaI];
               let data1 = JSON.stringify({"azione": "aggiungereParola", "parola": parole[nuovaI]});
               ws_server.clients.forEach((client) => {
                  if(!giocatoriInLeaderboard.includes(client.id)) {
                     client.send(data1);
                  }
               });
               break;
            case "diminuisciTempo":
               if(!giocatoriInLeaderboard.includes(ws.id) || punteggi[ws.id] < 3) {
                  return;
               }
               punteggi[ws.id] -= 3;
               tempoRoundAttuale -= 3;
               let tempoAttuale = (new Date() - tempoInizioRound)/ 1000;
               if(tempoRoundAttuale < tempoAttuale) {
                  iniziareAttesaTraRound();
               } else {
                  console.log(tempoInizioRound);
                  tempoTraRound(tempoRoundAttuale - tempoAttuale,numRound);
                  let data2 = JSON.stringify({"azione": "diminuitoTempo", "tempoRimanente": parseInt((tempoRoundAttuale - tempoAttuale))});
                  ws_server.clients.forEach((client) => {
                     client.send(data2);
                  });
               }
               break;
            case "cambiaParola":
               if(!giocatoriInLeaderboard.includes(ws.id) || punteggi[ws.id] < 3) {
                  return;
               }
               punteggi[ws.id] -= 3;
               let iSostituita;
               do{
                  iSostituita = parseInt(Math.random() * parole.length);
               }while(paroleRound.includes(parole[iSostituita]));
               paroleRound[paroleRound.length - 1] = parole[iSostituita];
               let data3 = JSON.stringify({"azione": "sostituitaParola", "parola": parole[iSostituita]});
               ws_server.clients.forEach((client) => {
                  if(!giocatoriInLeaderboard.includes(client.id)) {
                     client.send(data3);
                  }
               });
               break;
         }
      }
   });
});

function sleep(ms) {
   return new Promise(resolve => setTimeout(resolve, ms));
}