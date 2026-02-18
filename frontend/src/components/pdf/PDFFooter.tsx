import { View, Text } from '@react-pdf/renderer'
import { styles } from './styles'

interface PDFFooterProps {
  /** Optional text displayed on the left side of the footer (e.g. "Supplied and Installed."). */
  leftText?: string
}

export function PDFFooter({ leftText }: PDFFooterProps) {
  return (
    <View style={styles.footer} fixed>
      <Text>{leftText || ''}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  )
}
