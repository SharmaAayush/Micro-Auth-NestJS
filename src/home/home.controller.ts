import { Controller, Get, Render } from '@nestjs/common';
import { SkipEnvelope } from '../common/transform/response/skip-envelope.decorator';

@SkipEnvelope() // Prevent API envelope wrapping
@Controller()
export class HomeController {
  @Get()
  @Render('pages/home')
  getHome() {
    return {
      // Data to pass to the template
      headline: 'Auth you run yourself.',
      subhead:
        'Login, sessions, and OAuth for your other apps — one service, your servers, your data.',
      primaryCtaText: 'Get started → deploy/docs',
      secondaryCtaText: 'View on GitHub',
      features: [
        {
          title: 'Sign in once, everywhere.',
          description:
            'Warden issues sessions your other services can trust, so people log in once and move between apps without doing it again.',
        },
        {
          title: "See every place you're signed in.",
          description:
            'Every session shows its device, location, and last activity. Nothing hides in the background.',
        },
        {
          title: 'End access instantly.',
          description:
            'Sign out one device or all of them. Revoked sessions stop working immediately, not on their next refresh.',
        },
      ],
      trustStripText:
        "Self-hosted. Open source. Your users' credentials never leave your infrastructure.",
      footerCtaHeadline: 'Add sign-in to your app in an afternoon.',
      footerCtaText: 'Read the docs',
    };
  }
}
