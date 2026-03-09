'use client';

import { MegaFooter } from "@/components/MegaFooter";
import AnimatedAuth, {
  AUTH_COLORS_LIGHT,
  AUTH_COLORS_DARK,
  AnimatedAuthProps,
} from "@/components/AnimatedAuth";

// exported so other modules/pages can reuse or tweak the login palette
export const loginAuthColors: Partial<AnimatedAuthProps> = {
  ...AUTH_COLORS_LIGHT,
  // explicit overrides that match the screenshot
  themeColor: "#585151",
  themeColorDark: "#8c6a5d",
  glowColor: "rgba(32, 10, 8, 0.46)",
  glowColorDark: "rgba(16, 5, 4, 0.6)",
  transitionTintColor: "#d2b48c",
  transitionTintColorDark: "#2c241b",
  backgroundColor: "#e4e3e1",
  backgroundColorDark: "#2c241b",
  backdrop: "#ddd1c0",
  backdropDark: "#1f1515",
  placeholderColor: "rgb(0, 0, 0)",
  placeholderColorDark: "rgba(255, 255, 255, 1)",
  textColor: "#000000",
  textColorDark: "#ffffff",
  secondaryTextColor: "#6b7280",
  secondaryTextColorDark: "#9ca3af",
  borderColor: "#d1d5db",
  borderColorDark: "#4b5563",
  // panel text color overrides
  leftPanelTitleColor: '#000000',
  leftPanelSubtitleColor: '#000000',
  rightPanelTitleColor: '#000000',
  rightPanelSubtitleColor: '#000000',
};

export default function LoginPage() {
  return (
    <div className="flex flex-col min-h-screen ">
        <main>
      <AnimatedAuth
        {...loginAuthColors}
        leftPanelSubtitle='Lorem ipsum dolor sit amet consectetur adipisicing.'
        leftPanelTitle="STAY CONNECTED!"
        rightPanelTitle='HELLO FRIEND!'
        rightPanelSubtitle='Enter your personal details and start your journey with us.'
        leftPanelImage='Image1.jpg'
        rightPanelImage='Image2.jpg'
        // text color props can also be overridden here directly if needed
      />
      </main>
      <MegaFooter
        brandName="Bits"
        tagline="Designing delightful digital experiences."
        socialLinks={[
          { platform: "twitter", href: "https://twitter.com" },
          { platform: "github", href: "https://github.com/Medhansh-741/ps-crm"},
          { platform: "linkedin", href: "https://linkedin.com" },
        ]}
        showNewsletter={true}
        newsletterTitle="Stay updated"
        newsletterPlaceholder="Enter your email"
      />
    </div>
  );
}