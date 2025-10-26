import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function DisclaimerBanner() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60" data-testid="banner-disclaimer">
      <Alert className="rounded-none border-x-0 border-b-0">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between gap-4">
          <span className="text-xs sm:text-sm" data-testid="text-disclaimer">
            <strong>Educational & Research Platform.</strong> Not Investment Advice. Past Performance ≠ Future Results.
          </span>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" data-testid="button-full-disclaimer">
                Full Disclaimer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-disclaimer">
              <DialogHeader>
                <DialogTitle data-testid="text-disclaimer-title">Educational Disclaimer & Risk Warning</DialogTitle>
                <DialogDescription className="space-y-4 text-left pt-4">
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Educational Purpose Only</h3>
                    <p>
                      This platform is designed exclusively for educational and research purposes to demonstrate 
                      reinforcement learning techniques applied to financial markets. It is NOT intended to provide 
                      investment advice, financial planning, or trading recommendations.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground mb-2">No Investment Advice</h3>
                    <p>
                      Nothing on this platform should be construed as professional financial advice, recommendation, 
                      or endorsement to buy or sell any security or financial instrument. Always consult with a 
                      licensed financial advisor before making investment decisions.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Past Performance</h3>
                    <p>
                      Past performance, whether real or simulated, is not indicative of future results. Backtested 
                      performance does not represent actual trading and may not reflect the impact of material economic 
                      and market factors.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Risk of Loss</h3>
                    <p>
                      Trading and investing in financial markets involves substantial risk of loss. You can lose some 
                      or all of your investment capital. Never invest money you cannot afford to lose.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground mb-2">No Guarantee of Accuracy</h3>
                    <p>
                      While we strive for accuracy, this platform and its AI models may contain errors, bugs, or 
                      inaccuracies. The reinforcement learning models are experimental and may produce unpredictable 
                      results.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Paper Trading Mode</h3>
                    <p>
                      By default, this platform operates in Paper Trading mode using simulated funds. No real money 
                      is at risk. Any "Live Trading" mode requires explicit multi-step confirmation and should only 
                      be used by experienced traders who understand the risks.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Your Responsibility</h3>
                    <p>
                      You are solely responsible for your investment decisions and any resulting gains or losses. 
                      By using this platform, you acknowledge and accept all risks associated with financial trading.
                    </p>
                  </div>
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        </AlertDescription>
      </Alert>
    </div>
  );
}
