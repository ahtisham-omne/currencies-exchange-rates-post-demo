import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { RootLayout } from './pages/RootLayout';
import { QuotesListPage } from './pages/QuotesListPage';
import { QuoteDetails } from './pages/QuoteDetails';
import { EditQuote } from './pages/EditQuote';
import { PartnersShellPage } from './pages/PartnersShellPage';
import { PersonAvatarLightboxProvider } from './components/shared/PersonAvatarLightbox';

function QuoteDetailsWrapper() {
  const { quoteId } = useParams<{ quoteId: string }>();
  /* Bug A7: many `useState` initializers inside QuoteDetails read from
     the quote looked up by `quoteId`. React only runs initializers on
     first mount, so navigating between two quote ids reused the prior
     quote's state until a full refresh. Keying the component on
     `quoteId` forces a clean remount whenever the route param changes. */
  return <QuoteDetails key={quoteId} quoteId={quoteId!} />;
}

function EditQuoteWrapper() {
  const { quoteId } = useParams<{ quoteId: string }>();
  return <EditQuote key={quoteId} quoteId={quoteId!} />;
}

export default function App() {
  return (
    <PersonAvatarLightboxProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootLayout />}>
            <Route index element={<QuotesListPage />} />
            <Route path="quotes/:quoteId" element={<QuoteDetailsWrapper />} />
            <Route path="quotes/:quoteId/edit" element={<EditQuoteWrapper />} />
          </Route>
          {/* Partner Management new-tab shell — no RootLayout chrome,
              so the tab visually reads as its own module instead of a
              nested page inside Quotes. Opener pages route the user
              here via openPartnerTab(...) with action / seed query
              params; the shell auto-opens the matching modal and
              posts the result back on save. */}
          <Route path="/partners" element={<PartnersShellPage />} />
        </Routes>
      </BrowserRouter>
    </PersonAvatarLightboxProvider>
  );
}
