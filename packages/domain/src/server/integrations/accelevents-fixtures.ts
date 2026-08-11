// Demo fixture payloads for the Accelevents integration, shaped exactly like
// the real API responses (developer.accelevents.com):
//   GET /rest/host/event/{eventUrl}/speaker            → AccelSpeakersPage
//   GET /rest/events/{eventUrl}/staff/allAttendees     → AccelAttendeesPage
// The demo connection serves these so the full sync flow is demonstrable
// without a live Accelevents account.

export interface AccelSpeaker {
  readonly speakerId: number;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly title: string | null;
  readonly pronouns: string | null;
  readonly company: string | null;
  readonly bio: string | null;
  readonly imageUrl: string | null;
  readonly linkedIn: string | null;
  readonly twitter: string | null;
  readonly position: number;
}

export interface AccelSpeakersPage {
  readonly recordsTotal: number;
  readonly recordsFiltered: number;
  readonly data: ReadonlyArray<AccelSpeaker>;
  readonly error: string | null;
}

export interface AccelAttendee {
  readonly attendeeId: string;
  readonly barcode: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly status: string;
  readonly ticketStatus: string;
  readonly ticketType: string;
}

export interface AccelAttendeesPage {
  readonly attendees: ReadonlyArray<AccelAttendee>;
  readonly recordsFiltered: number;
  readonly recordsTotal: number;
}

export const demoSpeakersPage: AccelSpeakersPage = {
  recordsTotal: 6,
  recordsFiltered: 6,
  error: null,
  data: [
    {
      speakerId: 9101,
      firstName: "Priya",
      lastName: "Raghavan",
      email: "priya.raghavan@vectorshift.dev",
      title: "Head of Applied AI",
      pronouns: "she/her",
      company: "VectorShift",
      bio: "Priya leads applied AI at VectorShift, where her team ships retrieval systems used by 40k developers. Previously she built ranking infrastructure at a large search company.",
      imageUrl: "https://i.pravatar.cc/300?u=priya.raghavan@vectorshift.dev",
      linkedIn: "https://www.linkedin.com/in/priya-raghavan-demo",
      twitter: "https://twitter.com/priyaraghavan_demo",
      position: 1,
    },
    {
      speakerId: 9102,
      firstName: "Marcus",
      lastName: "Oyelaran",
      email: "marcus.o@parallelruntime.io",
      title: "CTO",
      pronouns: "he/him",
      company: "Parallel Runtime",
      bio: "Marcus co-founded Parallel Runtime after a decade of scheduler work in HPC. He cares about making distributed inference boring and predictable.",
      imageUrl: "https://i.pravatar.cc/300?u=marcus.o@parallelruntime.io",
      linkedIn: "https://www.linkedin.com/in/marcus-oyelaran-demo",
      twitter: null,
      position: 2,
    },
    {
      speakerId: 9103,
      firstName: "Sofia",
      lastName: "Lindqvist",
      email: "sofia@evalharness.se",
      title: "Founding Engineer",
      pronouns: "she/her",
      company: "Evalharness",
      bio: "Sofia builds evaluation tooling for regulated industries. She previously shipped safety cases for medical decision support software.",
      imageUrl: "https://i.pravatar.cc/300?u=sofia@evalharness.se",
      linkedIn: null,
      twitter: "https://twitter.com/sofialindqvist_demo",
      position: 3,
    },
    {
      speakerId: 9104,
      firstName: "Dmitri",
      lastName: "Volkov",
      email: "dmitri.volkov@tracequery.com",
      title: "Principal Engineer",
      pronouns: null,
      company: "TraceQuery",
      bio: "Dmitri works on observability for agentic systems — replayable traces, live taps, and the query language that makes both usable.",
      imageUrl: "https://i.pravatar.cc/300?u=dmitri.volkov@tracequery.com",
      linkedIn: "https://www.linkedin.com/in/dmitri-volkov-demo",
      twitter: null,
      position: 4,
    },
    {
      speakerId: 9105,
      firstName: "Hana",
      lastName: "Sato",
      email: "hana.sato@kernelgarden.jp",
      title: "Research Lead",
      pronouns: "she/her",
      company: "Kernel Garden",
      bio: "Hana researches small-model distillation and on-device inference. Her team's open checkpoints have 2M downloads.",
      imageUrl: "https://i.pravatar.cc/300?u=hana.sato@kernelgarden.jp",
      linkedIn: null,
      twitter: null,
      position: 5,
    },
    {
      speakerId: 9106,
      firstName: "Gabriel",
      lastName: "Mendes",
      email: "gabriel@turbina.ai",
      title: "VP Engineering",
      pronouns: "he/him",
      company: "Turbina",
      bio: "Gabriel runs engineering at Turbina, scaling LATAM's largest AI voice platform. He has strong opinions about incident reviews.",
      imageUrl: "https://i.pravatar.cc/300?u=gabriel@turbina.ai",
      linkedIn: "https://www.linkedin.com/in/gabriel-mendes-demo",
      twitter: "https://twitter.com/gmendes_demo",
      position: 6,
    },
  ],
};

export const demoAttendeesPage: AccelAttendeesPage = {
  recordsTotal: 8,
  recordsFiltered: 8,
  attendees: [
    {
      attendeeId: "att_7001",
      barcode: "AE-7001",
      email: "quinn.baker@modelfoundry.dev",
      firstName: "Quinn",
      lastName: "Baker",
      status: "CONFIRMED",
      ticketStatus: "CHECKED_IN",
      ticketType: "Conference Pass",
    },
    {
      attendeeId: "att_7002",
      barcode: "AE-7002",
      email: "leila.nasser@promptops.co",
      firstName: "Leila",
      lastName: "Nasser",
      status: "CONFIRMED",
      ticketStatus: "BOOKED",
      ticketType: "Conference Pass",
    },
    {
      attendeeId: "att_7003",
      barcode: "AE-7003",
      email: "tomas.jensen@latentspace.dk",
      firstName: "Tomas",
      lastName: "Jensen",
      status: "CONFIRMED",
      ticketStatus: "BOOKED",
      ticketType: "Workshop Add-on",
    },
    {
      attendeeId: "att_7004",
      barcode: "AE-7004",
      email: "amaka.eze@gradientworks.ng",
      firstName: "Amaka",
      lastName: "Eze",
      status: "CONFIRMED",
      ticketStatus: "CHECKED_IN",
      ticketType: "VIP Pass",
    },
    {
      attendeeId: "att_7005",
      barcode: "AE-7005",
      email: "victor.huang@finetune.gg",
      firstName: "Victor",
      lastName: "Huang",
      status: "CONFIRMED",
      ticketStatus: "BOOKED",
      ticketType: "Conference Pass",
    },
    {
      attendeeId: "att_7006",
      barcode: "AE-7006",
      email: "elsa.novak@checkpointzero.cz",
      firstName: "Elsa",
      lastName: "Novak",
      status: "CONFIRMED",
      ticketStatus: "BOOKED",
      ticketType: "Conference Pass",
    },
    {
      attendeeId: "att_7007",
      barcode: "AE-7007",
      email: "ryo.tanabe@shiftleft.jp",
      firstName: "Ryo",
      lastName: "Tanabe",
      status: "CONFIRMED",
      ticketStatus: "CANCELLED",
      ticketType: "Conference Pass",
    },
    {
      attendeeId: "att_7008",
      barcode: "AE-7008",
      email: "priya.raghavan@vectorshift.dev",
      firstName: "Priya",
      lastName: "Raghavan",
      status: "CONFIRMED",
      ticketStatus: "BOOKED",
      ticketType: "Speaker Pass",
    },
  ],
};
