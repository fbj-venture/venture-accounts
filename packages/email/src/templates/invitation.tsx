import { Body, Button, Column, Container, Head, Heading, Html, Img, Preview, Row, Section, Tailwind, Text } from "@react-email/components";
import { barebonesBoxedTailwindConfig } from './theme';
import { BarebonesFonts } from './theme-fonts';

export interface InvitationEmailProps {
  name: string;
  /** Company name shown in the copy, e.g. "Venture Church". */
  company: string;
  /** Link to the set-password page, carrying the invitation token. */
  url: string;
  /** Absolute public URL of the logo image shown in the header. */
  logoUrl: string;
  /** How many days the link works for. */
  validDays: number;
}

export function InvitationEmail({ name, company, url, validDays, logoUrl }: InvitationEmailProps) {
  return (
    <Tailwind config={barebonesBoxedTailwindConfig}>
      <Html lang="en">
        <Head>
          <BarebonesFonts />
        </Head>
        <Preview>You've been invited to {company} Accounts</Preview>
        <Body className="bg-bg-2 m-0 text-center font-sans">
          <Container className="mobile:mt-0 mx-auto mt-8 w-full max-w-[640px]">
            <Section>
              <Section className="bg-bg mobile:px-2 px-6 py-4">
                <Section className="mb-3 px-6">
                  <Row>
                    <Column className="py-[7px]" />
                    <Column className="w-[88px] py-[7px] align-middle">
                      <Img src={logoUrl} alt={company} width={80} className="block" />
                    </Column>
                    <Column align="right" className="py-[7px] align-middle">
                      <Text className="font-13 m-0 text-right font-sans whitespace-nowrap">
                        <span className="text-fg-3">{company} Accounts</span>
                      </Text>
                    </Column>
                  </Row>
                </Section>

                <Section className="bg-bg-2 mobile:px-6 mobile:py-12 rounded-[8px] px-[40px] py-[64px] text-center">
                  <Section className="mb-3">
                    <Heading as="h1" className="font-28 text-fg m-0 font-sans">
                      You&apos;re invited
                    </Heading>
                  </Section>

                  <Text>Hi {name},</Text>
                  <Text>
                    You've been invited to {company} Accounts. Choose a password to finish setting up your login:
                  </Text>
                  <Section className="mb-6 text-center">
                    <Button href={url} className="bg-brand font-16 text-fg-inverted inline-block rounded-lg px-7 py-4 text-center font-sans leading-6">Set my password</Button>
                  </Section>

                  <Text className="font-13 text-fg-3 mx-auto mt-8 mb-0 max-w-[400px] text-center font-sans">
                    This link works for {validDays} days.
                    <br />
                    If you weren&apos;t expecting this, you can ignore this email.
                  </Text>
                </Section>
              </Section>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}

InvitationEmail.PreviewProps = {
  name: "Jane",
  company: "Venture Church",
  url: "https://example.com/set-password?token=abc123",
  logoUrl: "https://example.com/img/venture-church.png",
  validDays: 7,
} satisfies InvitationEmailProps;

export default InvitationEmail;
