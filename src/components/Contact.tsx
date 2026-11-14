"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";

const EMAIL = "nabhpriyagautam@gmail.com";
const INSTAGRAM = "https://www.instagram.com/nabh.pg/?hl=en";
/** FormSubmit relays the form to the inbox with no server of our own. The first message ever sent triggers a one-time activation email. */
const ENDPOINT = `https://formsubmit.co/ajax/${EMAIL}`;

type State = "idle" | "sending" | "sent" | "error";

/** The last section: who Nabh is in two lines, his email, and a message box that sends straight from the page. */
export default function Contact() {
  const [state, setState] = useState<State>("idle");

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget, data = new FormData(form);
    if (data.get("_honey")) return; // filled only by bots
    setState("sending");
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: data.get("name"), email: data.get("email"), message: data.get("message"),
          _subject: `Portfolio message from ${data.get("name")}`, _template: "box", _captcha: "false",
        }),
      });
      const out = await res.json().catch(() => null);
      if (!res.ok || !out || String(out.success) !== "true") throw new Error("not accepted");
      form.reset();
      setState("sent");
    } catch {
      setState("error");
    }
  }

  return (
    <section id="contact" className="ct" aria-labelledby="ct-title">
      <div className="ct-grain" aria-hidden />
      <div className="ct-inner">
        {/* a print of Nabh, signed: soft-edged like the film frames earlier, autograph across the corner */}
        <figure className="ct-photo">
          <div className="ct-print">
            <Image src="/contact/nabh.jpg" alt="Nabh Priya Gautam, in profile, looking to the right" width={900} height={900} sizes="(max-width: 820px) 70vw, 24rem" />
            <span className="ct-leak" aria-hidden />
            <span className="ct-print-grain" aria-hidden />
          </div>
          <span className="ct-marks" aria-hidden><i /><i /><i /><i /></span>
          <span className="ct-sign" role="img" aria-label="Nabh's autograph" />
        </figure>
        <div className="ct-copy">
          <p className="ct-kicker"><span>04</span> Contact</p>
          <h2 id="ct-title">Let&rsquo;s make something.</h2>
          <p className="ct-about">
            I&rsquo;m Nabh: a student, a video editor and the co-founder of Markgenics. Away from the screen I read philosophy and literature, write poetry and learn languages.
          </p>
          <p className="ct-mail">
            <span>Write to me</span>
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
          </p>
          <p className="ct-mail ct-insta">
            <span>Instagram</span>
            <a href={INSTAGRAM} target="_blank" rel="noreferrer">@nabh.pg <i aria-hidden>↗</i></a>
          </p>
        </div>

        <form className="ct-form" onSubmit={send} noValidate={false}>
          <label>
            <span>Your name</span>
            <input name="name" type="text" autoComplete="name" required maxLength={80} />
          </label>
          <label>
            <span>Your email</span>
            <input name="email" type="email" autoComplete="email" required maxLength={120} />
          </label>
          <label>
            <span>Message</span>
            <textarea name="message" rows={5} required maxLength={4000} />
          </label>
          <input name="_honey" type="text" tabIndex={-1} autoComplete="off" className="ct-honey" aria-hidden />
          <div className="ct-actions">
            <button type="submit" disabled={state === "sending"}>
              {state === "sending" ? "Sending…" : "Send message"} <i aria-hidden>→</i>
            </button>
            <p className="ct-status" role="status" aria-live="polite">
              {state === "sent" && "Sent. I’ll reply to the email you gave."}
              {state === "error" && (
                <>That didn’t go through. Email me directly at <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.</>
              )}
            </p>
          </div>
        </form>
      </div>
      <p className="ct-foot">© Nabh Priya Gautam</p>
    </section>
  );
}
