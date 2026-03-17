"use client";

import useTRWMembership from "@/hooks/trw/useTRWMembership";
import { TRWAccessGate } from "@/components/trw/TRWAccessGate";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Calendar, CheckCircle2, ShieldCheck, User } from "lucide-react";
import { format } from "date-fns";

export default function MyAccessPage() {
  const { data: membership } = useTRWMembership();

  return (
    <div className="container py-12 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">My TRW Access</h1>

      <TRWAccessGate>
        {membership && (
          <div className="grid gap-8">
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="p-3 bg-primary rounded-full">
                  <ShieldCheck className="w-8 h-8 text-primary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Active Membership</CardTitle>
                  <CardDescription>
                    You have full access to authorized content.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-6 pt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Plan Type</p>
                      <Badge variant="outline" className="mt-1">
                        {membership.plan?.name || "Standard Access"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Granted At</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(membership.granted_at), "PPP")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">Status</p>
                      <p className="text-sm text-green-600 font-semibold uppercase tracking-wider">
                        Verified & Active
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Expires At</p>
                      <p className="text-sm text-muted-foreground">
                        {membership.expires_at
                          ? format(new Date(membership.expires_at), "PPP")
                          : "Never (Permanent)"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              <h2 className="text-xl font-semibold">Membership Benefits</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  "Full Access to Categories",
                  "Exclusive Course Content",
                  "Personal Progress Tracking",
                ].map((benefit) => (
                  <Card key={benefit} className="bg-card/50">
                    <CardContent className="p-4 flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">{benefit}</span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}
      </TRWAccessGate>
    </div>
  );
}
