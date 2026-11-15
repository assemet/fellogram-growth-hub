import type { LegalContent } from "./types";

export const en: LegalContent = {
  updated: "Last updated",
  agreeStore: "By creating a store you agree to:",
  privacy: {
    title: "Privacy Policy",
    intro:
      "Fellogram is a loyalty app that runs inside Telegram. This policy explains what we collect, why, who can see it and how you can delete it. We keep it short and plain on purpose.",
    sections: [
      {
        heading: "What we collect",
        bullets: [
          "From Telegram, when you open the app: your Telegram ID, first and last name, username, profile photo link and language.",
          "Your activity: the loyalty cards you join, stamps, rewards and offers you use, and referrals you make or receive.",
          "If you turn on notifications: that choice, and a record of the reminders we sent you.",
          "For store owners and cashiers: the store's name, logo, loyalty program, offers, team members and the invitations you create.",
          "On your device: your sign-in session and your preferences (language, appearance, text size, sounds) are kept in the browser storage of the Telegram app. We do not use advertising cookies or trackers.",
          "Technical logs: our hosting and database providers keep standard server logs (such as IP address and time) to keep the service secure and running.",
        ],
        paragraphs: [
          "We do not ask for your phone number, email address, location, contacts or payment details. The camera is used only when you tap a scan button, only to read a QR code, and the images are not saved or uploaded.",
        ],
      },
      {
        heading: "How we use it",
        bullets: [
          "To run your cards, stamps, rewards and offers.",
          "To show your name to the stores where you hold a card, so their cashiers can recognise you.",
          "To send the reminders and reward notices you have opted into.",
          "To prevent fraud and abuse, for example with one-time QR codes and usage limits.",
          "To keep the service secure, fix errors and answer your messages.",
        ],
        paragraphs: ["We do not sell your data and we do not use it for advertising."],
      },
      {
        heading: "Who can see it",
        bullets: [
          "The stores where you hold a card see your name, username, stamp balance and your activity at that store. They do not see your activity at other stores.",
          "A store owner also sees what their cashiers did, such as stamps given and how.",
          "Other customers cannot see your data.",
          "Service providers that process data for us: Supabase (database and sign-in), Vercel (hosting) and Telegram (the platform and bot messages), each under its own terms.",
          "Authorities, only when the law requires it.",
        ],
      },
      {
        heading: "Stores are responsible too",
        paragraphs: [
          "Each store decides how to run its own loyalty program. Stores can see the data above about their own customers and must use it only to run that program. For questions about a store's program, contact the store directly.",
        ],
      },
      {
        heading: "Notifications",
        paragraphs: [
          "Messages come from our Telegram bot, and only if you turned notifications on. You can turn them off at any time in Settings. A store can send a given customer at most one reminder every 14 days.",
        ],
      },
      {
        heading: "How long we keep it, and deleting it",
        paragraphs: [
          "We keep your data while your account exists. You can delete it yourself at any time: Settings → Your data → Delete my account and data. This removes your profile, cards, stamps, history, referrals and notification records from the live system straight away, and it cannot be undone.",
          "If you only remove one store's card, that store keeps its past stamp record; delete your account to remove everything. If a store owner deletes their store, its program and all cards for that store are deleted.",
          "Backups kept by our database provider are overwritten on their normal schedule, after which the data is gone. Technical logs are kept briefly by our providers.",
        ],
      },
      {
        heading: "Your choices and rights",
        paragraphs: [
          "You can ask to see, correct or delete your data, or object to how we use it. Deleting is available in the app; for anything else, contact us. Depending on where you live, laws such as the GDPR or similar may give you these rights, and we handle such requests the same way for everyone.",
        ],
      },
      {
        heading: "Security",
        paragraphs: [
          "Connections are encrypted. Access rules mean customers can only see their own data, and QR codes are single-use and short-lived. No system is perfectly secure, so we cannot promise absolute security.",
        ],
      },
      {
        heading: "Other countries",
        paragraphs: ["Our providers may process data in countries other than yours."],
      },
      {
        heading: "Children",
        paragraphs: [
          "Fellogram is not meant for children under 13, or under the age that Telegram or your local law requires. If we learn that we hold a child's data without permission, we delete it.",
        ],
      },
      {
        heading: "Changes",
        paragraphs: ["If we change this policy we update the date above, and tell you in the app when the change is significant."],
      },
    ],
    contact: {
      heading: "Contact",
      withEmail: "Questions or requests about your data: {email}",
      withoutEmail: "Questions or requests about your data: use the Help & FAQ page in the app.",
    },
  },
  terms: {
    title: "Terms of Use",
    intro: "These terms apply when you use Fellogram, the Telegram app and bot for digital loyalty cards. By using it you agree to them. If you do not agree, please do not use it.",
    sections: [
      {
        heading: "What Fellogram is",
        paragraphs: [
          "Fellogram lets stores run digital loyalty cards inside Telegram. The stores, not Fellogram, offer the rewards and offers, and decide their rules. We are not a party to what happens between a store and its customers.",
        ],
      },
      {
        heading: "Your account",
        bullets: [
          "You sign in through Telegram. You are responsible for what happens under your account, so keep your Telegram account secure.",
          "Keep one account per person and give true information.",
          "Stores agree to these terms on behalf of their business.",
        ],
      },
      {
        heading: "For customers",
        bullets: [
          "Stamps and rewards are set by each store and have no cash value.",
          "A store may change or end its program or offers, and rewards are subject to that store's conditions.",
          "Your QR code is personal and short-lived. Do not use it to collect stamps you did not earn.",
        ],
      },
      {
        heading: "For stores and their staff",
        bullets: [
          "You are responsible for your program, your offers, the rewards you promise and the conduct of your cashiers. Honour the rewards you offer.",
          "Give stamps only for real purchases or visits. Do not stamp for people who are not there, and only invite people you trust.",
          "Use customers' data only to run your loyalty program, as described in the Privacy Policy, and follow the laws that apply to you.",
        ],
      },
      {
        heading: "Acceptable use",
        lead: "You agree not to:",
        bullets: [
          "Forge, farm or trade stamps, or reuse or share QR codes to get stamps.",
          "Use bots or scripts, scrape the service, or try to break, overload or reverse-engineer it.",
          "Access other people's data or impersonate anyone.",
          "Publish unlawful, offensive or misleading content, such as store names or offers.",
          "Use reminders to spam people.",
        ],
      },
      {
        heading: "Paid plans",
        paragraphs: ["Fellogram is currently free. If we introduce paid plans, we will tell you before any charge, and you can choose not to continue."],
      },
      {
        heading: "Availability and changes",
        paragraphs: [
          "The service is provided as it is and as available. We may change, pause or stop features, and we will try to give notice of important changes.",
        ],
      },
      {
        heading: "Suspension and ending",
        paragraphs: [
          "We may suspend or remove accounts or stores that break these terms or put others at risk. You can delete your account at any time in Settings; your data is then handled as described in the Privacy Policy.",
        ],
      },
      {
        heading: "Liability",
        paragraphs: [
          "To the extent the law allows, we are not liable for indirect losses, lost profits or lost data, or for what stores or customers do or fail to do. Our total liability to you is limited to what you paid us in the previous 12 months, which is currently nothing. Nothing here limits rights that cannot be limited by law.",
        ],
      },
      {
        heading: "Changes to these terms",
        paragraphs: ["If we change these terms we update the date above. Using Fellogram after a change means you accept the new terms."],
      },
    ],
    contact: {
      heading: "Contact",
      withEmail: "Questions about these terms: {email}",
      withoutEmail: "Questions about these terms: use the Help & FAQ page in the app.",
    },
  },
};
