import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { RootLayout } from './pages/RootLayout';
import { QuotesListPage } from './pages/QuotesListPage';
import { QuoteDetails } from './pages/QuoteDetails';
import { EditQuote } from './pages/EditQuote';
import { RateProvider } from './context/RateContext';

function QuoteDetailsWrapper() {
  const { quoteId } = useParams<{ quoteId: string }>();
  return <QuoteDetails quoteId={quoteId!} />;
}

function EditQuoteWrapper() {
  const { quoteId } = useParams<{ quoteId: string }>();
  return <EditQuote quoteId={quoteId!} />;
}

export default function App() {
  return (
    <RateProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<RootLayout />}>
            <Route index element={<QuotesListPage />} />
            <Route path="quotes/:quoteId" element={<QuoteDetailsWrapper />} />
            <Route path="quotes/:quoteId/edit" element={<EditQuoteWrapper />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </RateProvider>
  );
}
