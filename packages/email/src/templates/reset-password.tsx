import { Body, Button, Column, Container, Head, Heading, Html, Img, Preview, Row, Section, Tailwind, Text } from "@react-email/components";
import { barebonesBoxedTailwindConfig } from './theme';
import { BarebonesFonts } from './theme-fonts';

export interface ResetPasswordEmailProps {
  name: string;
  /** Company name shown in the copy, e.g. "Venture Church". */
  company: string;
  /** Single-use reset link from Better-Auth. */
  url: string;
  /** Absolute public URL of the logo image shown in the header. */
  logoUrl: string;
}

// TODO: styling/branding. Copy mirrors the previous inline HTML in auth.ts.
export function ResetPasswordEmail({ name, company, url, logoUrl }: ResetPasswordEmailProps) {
  return (
    <Tailwind config={barebonesBoxedTailwindConfig}>

      <Html lang="en">
        <Head>
          <BarebonesFonts />
        </Head>
        <Preview>Reset your {company} Accounts password</Preview>
        <Body className="bg-bg-2 m-0 text-center font-sans">
          <Preview>Reset your password</Preview>
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
                    {/* <Img
                    src={`${baseUrl}/static/shared/logo-black.png`}
                    alt="Logo"
                    width={48}
                    className="mx-auto mb-5 block"
                  /> */}
                    <Heading as="h1" className="font-28 text-fg m-0 font-sans">
                      Password reset
                    </Heading>
                  </Section>

                  <Text>Hi {name},</Text>
                  <Text>
                    We received a request to reset your {company} Accounts password. This link works for one hour:
                  </Text>
                  <Section className="mb-6 text-center">
                    <Button href={url} className="bg-brand font-16 text-fg-inverted inline-block rounded-lg px-7 py-4 text-center font-sans leading-6">Reset my password</Button>
                    <Text>If you didn't ask for this, you can ignore this email - your password won't change.</Text>
                  </Section>

                  <Text className="font-13 text-fg-3 mx-auto mt-8 mb-0 max-w-[400px] text-center font-sans">
                    If you didn&apos;t request this,
                    <br />
                    please ignore this email.
                  </Text>
                </Section>

                {/* Footer */}
                <Section className="bg-bg">
                </Section>
              </Section>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}

ResetPasswordEmail.PreviewProps = {
  name: "Jane",
  company: "Venture Church",
  url: "https://example.com/set-password?token=abc123",
  logoUrl: "https://example.com/img/venture-church.png",
} satisfies ResetPasswordEmailProps;

export default ResetPasswordEmail;
